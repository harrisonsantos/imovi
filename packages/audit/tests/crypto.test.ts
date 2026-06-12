/**
 * Testes de crypto.ts — AES-GCM via WebCrypto (edge-safe, sem node:crypto).
 */
import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret } from '../src/crypto.js';

const SEGREDO = 'minha-chave-mestra-do-worker';

describe('encryptSecret / decryptSecret', () => {
  it('faz round-trip: decrypt(encrypt(x)) === x', async () => {
    const plain = 'vista-api-key-super-secreta-123';
    const enc = await encryptSecret(plain, SEGREDO);
    const dec = await decryptSecret(enc, SEGREDO);
    expect(dec).toBe(plain);
  });

  it('produz saída no formato base64iv.base64ciphertext', async () => {
    const enc = await encryptSecret('abc', SEGREDO);
    const partes = enc.split('.');
    expect(partes).toHaveLength(2);
    // Ambas as partes devem ser base64 válido (atob não lança).
    expect(() => atob(partes[0]!)).not.toThrow();
    expect(() => atob(partes[1]!)).not.toThrow();
    // IV de AES-GCM tem 12 bytes.
    expect(atob(partes[0]!).length).toBe(12);
  });

  it('gera IV aleatório — duas cifragens do mesmo texto diferem', async () => {
    const a = await encryptSecret('mesmo-texto', SEGREDO);
    const b = await encryptSecret('mesmo-texto', SEGREDO);
    expect(a).not.toBe(b);
  });

  it('falha ao decifrar com a chave errada', async () => {
    const enc = await encryptSecret('segredo', SEGREDO);
    await expect(decryptSecret(enc, 'outra-chave-errada')).rejects.toThrow();
  });

  it('falha ao decifrar entrada malformada', async () => {
    await expect(decryptSecret('nao-tem-formato-valido', SEGREDO)).rejects.toThrow();
  });

  it('suporta strings unicode (acentos, emoji)', async () => {
    const plain = 'chave-ação-imóvel-🏠';
    const enc = await encryptSecret(plain, SEGREDO);
    expect(await decryptSecret(enc, SEGREDO)).toBe(plain);
  });
});
