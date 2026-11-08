describe('humo core', () => {
  it('WebCrypto de Node esta disponible en globalThis.crypto', async () => {
    expect(globalThis.crypto?.subtle).toBeDefined();
    const datos = new TextEncoder().encode('vozvial');
    const resumen = await globalThis.crypto.subtle.digest('SHA-256', datos);
    expect(resumen.byteLength).toBe(32);
  });
});
