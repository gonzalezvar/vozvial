import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';

import { Caso, type CasoJSON } from '../core/Caso';
import type { IntentosSerializados } from '../core/ControlIntentos';
import type { ClaveEnvuelta, DatosCifrados, GestorClaves } from '../core/GestorClaves';
import type { Credencial } from '../core/ServicioCredenciales';

export const NOMBRE_BASE = 'vozvial';
const VERSION_BASE = 1;
const CLAVE_CUENTA = 'cuenta';
const LARGO_IV_BYTES = 12;
/** Prefijo de lo que la app guarda en localStorage (por ejemplo "vozvial.ajustes"). */
const PREFIJO_LOCAL_STORAGE = 'vozvial';

/** Registro unico de la cuenta. Lo unico en claro son metadatos tecnicos (hash, sal, iv, iteraciones). */
export interface RegistroCuenta {
  credencial: Credencial;
  claveEnvueltaPin: ClaveEnvuelta;
  claveEnvueltaRecuperacion: ClaveEnvuelta;
  controlIntentos: IntentosSerializados;
  /** { nombre, celular } cifrado con la clave de datos. */
  perfilCifrado: DatosCifrados;
}

export interface RegistroCaso extends DatosCifrados {
  id: string;
}

export interface RegistroEvidencia {
  id: string;
  casoId: string;
  iv: Uint8Array<ArrayBuffer>;
  datos: ArrayBuffer;
}

interface EsquemaVozVial extends DBSchema {
  cuenta: { key: string; value: RegistroCuenta };
  casos: { key: string; value: RegistroCaso };
  evidencias: { key: string; value: RegistroEvidencia; indexes: { casoId: string } };
}

/**
 * Persistencia local en IndexedDB. Casos y contenido de evidencias se guardan cifrados con
 * AES-GCM usando la clave de datos de la sesion; nunca se escribe texto del usuario en claro.
 */
export class AlmacenCifrado {
  private conexion: Promise<IDBPDatabase<EsquemaVozVial>> | null = null;

  constructor(
    private readonly gestor: GestorClaves,
    private readonly crypto: Crypto,
    private readonly nombreBase: string = NOMBRE_BASE,
  ) {}

  abrir(): Promise<IDBPDatabase<EsquemaVozVial>> {
    this.conexion ??= openDB<EsquemaVozVial>(this.nombreBase, VERSION_BASE, {
      upgrade(db) {
        db.createObjectStore('cuenta');
        db.createObjectStore('casos', { keyPath: 'id' });
        db.createObjectStore('evidencias', { keyPath: 'id' }).createIndex('casoId', 'casoId');
      },
    });
    return this.conexion;
  }

  async guardarCuenta(cuenta: RegistroCuenta): Promise<void> {
    await (await this.abrir()).put('cuenta', cuenta, CLAVE_CUENTA);
  }

  async leerCuenta(): Promise<RegistroCuenta | null> {
    return (await (await this.abrir()).get('cuenta', CLAVE_CUENTA)) ?? null;
  }

  async guardarCaso(clave: CryptoKey, caso: Caso): Promise<void> {
    const cifrado = await this.gestor.cifrar(clave, JSON.stringify(caso.toJSON()));
    await (await this.abrir()).put('casos', { id: caso.id, iv: cifrado.iv, datos: cifrado.datos });
  }

  async leerCaso(clave: CryptoKey, id: string): Promise<Caso | null> {
    const registro = await (await this.abrir()).get('casos', id);
    return registro ? this.descifrarCaso(clave, registro) : null;
  }

  async listarCasos(clave: CryptoKey): Promise<Caso[]> {
    const registros = await (await this.abrir()).getAll('casos');
    return Promise.all(registros.map((r) => this.descifrarCaso(clave, r)));
  }

  /** Borra el caso y el contenido de todas sus evidencias en una sola transaccion. */
  async borrarCaso(id: string): Promise<void> {
    const db = await this.abrir();
    const tx = db.transaction(['casos', 'evidencias'], 'readwrite');
    const evidencias = tx.objectStore('evidencias');
    const ids = await evidencias.index('casoId').getAllKeys(id);
    await Promise.all([tx.objectStore('casos').delete(id), ...ids.map((k) => evidencias.delete(k)), tx.done]);
  }

  async guardarContenidoEvidencia(
    clave: CryptoKey,
    evidenciaId: string,
    casoId: string,
    bytes: Uint8Array,
  ): Promise<void> {
    const iv = this.crypto.getRandomValues(new Uint8Array(LARGO_IV_BYTES));
    // Copia a un ArrayBuffer propio: WebCrypto no acepta vistas sobre SharedArrayBuffer.
    const claro = new Uint8Array(bytes.byteLength);
    claro.set(bytes);
    const datos = await this.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, clave, claro);
    await (await this.abrir()).put('evidencias', { id: evidenciaId, casoId, iv, datos });
  }

  /** Lanza un Error si la evidencia no tiene contenido guardado o la clave no corresponde. */
  async leerContenidoEvidencia(clave: CryptoKey, id: string): Promise<Uint8Array<ArrayBuffer>> {
    const registro = await (await this.abrir()).get('evidencias', id);
    if (!registro) throw new Error(`La evidencia ${id} no tiene contenido guardado.`);
    const iv = new Uint8Array(registro.iv);
    const claro = await this.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, clave, registro.datos);
    return new Uint8Array(claro);
  }

  async borrarContenidoEvidencia(id: string): Promise<void> {
    await (await this.abrir()).delete('evidencias', id);
  }

  /** Borra la base completa y lo que la app dejo en localStorage. */
  async borrarTodo(): Promise<void> {
    if (this.conexion) {
      (await this.conexion).close();
      this.conexion = null;
    }
    await deleteDB(this.nombreBase);
    AlmacenCifrado.borrarLocalStorage();
  }

  private async descifrarCaso(clave: CryptoKey, registro: RegistroCaso): Promise<Caso> {
    const texto = await this.gestor.descifrarTexto(clave, { iv: registro.iv, datos: registro.datos });
    return Caso.desdeJSON(JSON.parse(texto) as CasoJSON);
  }

  private static borrarLocalStorage(): void {
    try {
      const ls = (globalThis as { localStorage?: Storage }).localStorage;
      if (!ls) return;
      const claves: string[] = [];
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i);
        if (k?.startsWith(PREFIJO_LOCAL_STORAGE)) claves.push(k);
      }
      for (const k of claves) ls.removeItem(k);
    } catch {
      // Navegador sin localStorage disponible: no hay nada que borrar.
    }
  }
}
