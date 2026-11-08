import type { Consultor } from './conexion';

/** Sesiones del servidor. Solo se guarda el SHA-256 del token: si se filtra la tabla, los tokens no sirven. */
export class RepositorioSesiones {
  constructor(private readonly bd: Consultor) {}

  async crear(tokenHash: string, cuentaId: string, expiraEn: Date): Promise<void> {
    await this.bd.consultar('INSERT INTO sesiones (token_hash, cuenta_id, expira_en) VALUES ($1, $2, $3)', [
      tokenHash,
      cuentaId,
      expiraEn,
    ]);
  }

  /** Id de la cuenta si la sesion existe y no ha vencido. */
  async cuentaDe(tokenHash: string, ahora: Date): Promise<string | null> {
    const filas = await this.bd.consultar<{ cuenta_id: string }>(
      'SELECT cuenta_id FROM sesiones WHERE token_hash = $1 AND expira_en > $2',
      [tokenHash, ahora],
    );
    return filas[0]?.cuenta_id ?? null;
  }

  async borrar(tokenHash: string): Promise<void> {
    await this.bd.consultar('DELETE FROM sesiones WHERE token_hash = $1', [tokenHash]);
  }

  /** Cierra todas las sesiones de la cuenta (por ejemplo, al recuperar con el codigo). */
  async borrarDeCuenta(cuentaId: string): Promise<void> {
    await this.bd.consultar('DELETE FROM sesiones WHERE cuenta_id = $1', [cuentaId]);
  }

  async purgarVencidas(ahora: Date): Promise<void> {
    await this.bd.consultar('DELETE FROM sesiones WHERE expira_en <= $1', [ahora]);
  }
}
