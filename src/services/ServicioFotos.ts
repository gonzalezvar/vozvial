import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export interface FotoElegida {
  bytes: Uint8Array<ArrayBuffer>;
  mime: string;
}

export type OrigenFoto = 'camara' | 'galeria';

export class ErrorFoto extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorFoto';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const MOTIVO_NO_ES_IMAGEN = 'El archivo que elegiste no es una foto. Elige una imagen.';
export const MOTIVO_SIN_PERMISO_CAMARA = 'No diste permiso para usar la cámara. Puedes elegir una foto guardada.';

/**
 * Toma o elige una foto y entrega sus bytes para cifrarlos. En web usa un input de archivo
 * (con capture=environment abre la camara del celular); en el celular nativo, expo-image-picker.
 * Devuelve null si la persona cancela.
 */
export class ServicioFotos {
  elegir(origen: OrigenFoto = 'camara'): Promise<FotoElegida | null> {
    return Platform.OS === 'web' ? this.elegirWeb(origen) : this.elegirNativa(origen);
  }

  private elegirWeb(origen: OrigenFoto): Promise<FotoElegida | null> {
    return new Promise((resolver, rechazar) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      if (origen === 'camara') input.setAttribute('capture', 'environment');
      input.style.display = 'none';
      document.body.appendChild(input);
      const limpiar = () => input.remove();

      input.addEventListener(
        'change',
        () => {
          const archivo = input.files?.[0];
          limpiar();
          if (!archivo) return resolver(null);
          if (!archivo.type.startsWith('image/')) return rechazar(new ErrorFoto(MOTIVO_NO_ES_IMAGEN));
          archivo
            .arrayBuffer()
            .then((buffer) => resolver({ bytes: new Uint8Array(buffer), mime: archivo.type }))
            .catch(() => rechazar(new ErrorFoto('No pudimos leer la foto. Intenta de nuevo.')));
        },
        { once: true },
      );
      input.addEventListener(
        'cancel',
        () => {
          limpiar();
          resolver(null);
        },
        { once: true },
      );
      // Se abre dentro del mismo toque: los navegadores bloquean el selector si no viene de un gesto.
      input.click();
    });
  }

  private async elegirNativa(origen: OrigenFoto): Promise<FotoElegida | null> {
    if (origen === 'camara') {
      const permiso = await ImagePicker.requestCameraPermissionsAsync();
      if (!permiso.granted) throw new ErrorFoto(MOTIVO_SIN_PERMISO_CAMARA);
    }
    const opciones: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, exif: false };
    const resultado =
      origen === 'camara' ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
    const asset = resultado.canceled ? null : resultado.assets[0];
    if (!asset) return null;
    const respuesta = await fetch(asset.uri);
    const bytes = new Uint8Array(await respuesta.arrayBuffer());
    return { bytes, mime: asset.mimeType?.startsWith('image/') ? asset.mimeType : 'image/jpeg' };
  }
}
