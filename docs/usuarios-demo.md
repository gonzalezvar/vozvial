# Usuarios de demostración

> **Advertencia.** Estas cuentas son **ficticias y públicas**: sirven solo para probar y mostrar el prototipo.
> Los nombres, celulares, PIN, códigos de recuperación, placas y números de comparendo son inventados.
> No guardes datos reales en ellas: cualquiera que lea este documento puede entrar.

| Nombre | Celular | PIN | Código de recuperación |
|---|---|---|---|
| Rosa Elena Demo | 3001112233 | 482915 | RSEN-DEMA-4827 |
| Jorge Ivan Demo | 3002223344 | 730264 | JGVN-DEMB-5938 |
| Carmen Lucia Demo | 3003334455 | 615038 | CRMN-DEMC-6249 |

## Qué trae cada cuenta

Las fechas se calculan el día en que se siembra, con los parámetros verificados de `data/normativa/parametros.json`
y los festivos de Colombia. Por eso el caso "por vencer" solo está por vencer los días siguientes a la siembra:
para refrescarlo hay que volver a correr la semilla.

- **Rosa Elena Demo** (3001112233):
  - Código C02: comparendo en la vía con el plazo por vencer en 1 o 2 días hábiles, con una nota y con una foto.
  - Código B01: comparendo en la vía con el plazo vencido.
  - Código C29: comparendo por fotodetección (notificación recibida hace 2 días).
- **Jorge Ivan Demo** (3002223344):
  - Código D04: comparendo en la vía con el plazo por vencer en 1 o 2 días hábiles, con una nota.
  - Código C29: comparendo por fotodetección (notificación recibida hace 2 días).
- **Carmen Lucia Demo** (3003334455):
  - Código C35: comparendo en la vía con el plazo vencido, con una nota.
  - Código C14: comparendo en la vía con el plazo por vencer en 1 o 2 días hábiles.

Los códigos de infracción existen y están verificados en `data/infracciones.json`.

## Cómo se siembran

```bash
# Contra una base local (PGlite en una carpeta) o un Postgres propio:
npx tsx scripts/sembrar-demo.ts --url-bd postgres://usuario:clave@localhost:5432/vozvial
# Sin --url-bd usa DATABASE_URL. Con --pglite <carpeta> usa PGlite en disco.
```

La semilla es idempotente: si una cuenta ya existe, la borra con sus casos y la vuelve a crear.
Los casos quedan cifrados con la clave de datos de cada cuenta, en el mismo formato que usa la app,
así que el servidor no puede leerlos: solo se abren entrando con el celular y el PIN de esta tabla.
