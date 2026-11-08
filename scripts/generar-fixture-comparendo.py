"""
Genera las imagenes de prueba del comparendo para las pruebas e2e de HU-09.

Son documentos sinteticos con datos ficticios y una marca de agua
"DOCUMENTO DE PRUEBA - NO VALIDO". El diseno es neutro a proposito: no imita
el formato de ningun organismo de transito real.

- e2e/fixtures/comparendo-prueba.png: todos los datos legibles (CA-09.1).
- e2e/fixtures/comparendo-borroso.png: la placa esta manchada y borrosa, para
  que el OCR la lea con baja confianza (CA-09.2).

El codigo C29 existe y esta verificado en data/infracciones.json. Se evita un
codigo con cero (como C02) porque en esta fuente el OCR lo lee como la letra O
y lo marca dudoso, y CA-09.1 necesita una imagen sin datos dudosos.

Uso: python3 scripts/generar-fixture-comparendo.py
"""

import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, "e2e", "fixtures")
FUENTE = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FUENTE_NEGRITA = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

ANCHO, ALTO = 1200, 900

# Datos ficticios. El numero no corresponde a ningun comparendo real.
LINEAS = [
    ("Comparendo No. 99000012345678", "numero"),
    ("Fecha: 13/11/2026", "fecha"),
    ("Placa: TST123", "placa"),
    ("Codigo de infraccion: C29", "codigo"),
    ("Tipo: en la via", "tipo"),
]


def marca_de_agua(base: Image.Image) -> Image.Image:
    capa = Image.new("RGBA", base.size, (255, 255, 255, 0))
    dibujo = ImageDraw.Draw(capa)
    fuente = ImageFont.truetype(FUENTE_NEGRITA, 64)
    texto = "DOCUMENTO DE PRUEBA — NO VÁLIDO"
    caja = dibujo.textbbox((0, 0), texto, font=fuente)
    ancho, alto = caja[2] - caja[0], caja[3] - caja[1]
    lienzo = Image.new("RGBA", (ancho + 40, alto + 40), (255, 255, 255, 0))
    ImageDraw.Draw(lienzo).text((20, 20), texto, font=fuente, fill=(200, 40, 40, 70))
    girado = lienzo.rotate(28, expand=True)
    for y in (60, 520):
        capa.alpha_composite(girado, ((base.size[0] - girado.size[0]) // 2, y))
    return Image.alpha_composite(base, capa)


def dibujar(borroso: bool) -> Image.Image:
    img = Image.new("RGBA", (ANCHO, ALTO), (255, 255, 255, 255))
    d = ImageDraw.Draw(img)
    titulo = ImageFont.truetype(FUENTE_NEGRITA, 44)
    normal = ImageFont.truetype(FUENTE, 40)
    pequena = ImageFont.truetype(FUENTE, 26)

    d.rectangle([20, 20, ANCHO - 20, ALTO - 20], outline=(60, 60, 60, 255), width=4)
    d.text((60, 50), "Orden de prueba (ficticia)", font=titulo, fill=(0, 0, 0, 255))
    d.text((60, 110), "Documento sintetico para pruebas de software", font=pequena, fill=(40, 40, 40, 255))

    y = 200
    caja_placa = None
    for texto, campo in LINEAS:
        d.text((60, y), texto, font=normal, fill=(0, 0, 0, 255))
        if campo == "placa":
            ancho_etiqueta = d.textlength("Placa: ", font=normal)
            caja_placa = (int(60 + ancho_etiqueta) - 6, y - 6, int(60 + d.textlength(texto, font=normal)) + 8, y + 52)
        y += 90

    d.text((60, ALTO - 90), "Datos ficticios. No sirve como documento.", font=pequena, fill=(40, 40, 40, 255))

    img = marca_de_agua(img)

    if borroso and caja_placa:
        # Mancha y desenfoque sobre la placa: simula una foto con ese dato poco legible.
        recorte = img.crop(caja_placa).filter(ImageFilter.GaussianBlur(5))
        img.paste(recorte, caja_placa[:2])
        mancha = ImageDraw.Draw(img)
        azar = random.Random(7)
        for _ in range(260):
            x = azar.randint(caja_placa[0], caja_placa[2])
            yy = azar.randint(caja_placa[1], caja_placa[3])
            r = azar.randint(2, 6)
            gris = azar.randint(90, 170)
            mancha.ellipse([x - r, yy - r, x + r, yy + r], fill=(gris, gris, gris, 255))

    return img.convert("RGB")


def main() -> None:
    os.makedirs(SALIDA, exist_ok=True)
    dibujar(False).save(os.path.join(SALIDA, "comparendo-prueba.png"))
    dibujar(True).save(os.path.join(SALIDA, "comparendo-borroso.png"))
    print("Listo:", os.path.join(SALIDA, "comparendo-prueba.png"), os.path.join(SALIDA, "comparendo-borroso.png"))


if __name__ == "__main__":
    main()
