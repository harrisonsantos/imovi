/**
 * Cifragem de segredos (ex.: Vista API key) com AES-256-GCM via WebCrypto.
 *
 * Edge-safe: usa apenas globalThis.crypto.subtle (Workers e Node 20+),
 * NUNCA node:crypto. A chave AES é derivada do segredo via SHA-256.
 *
 * Formato de saída: `base64(iv).base64(ciphertext)` — IV de 12 bytes,
 * aleatório por cifragem (nunca reutilizado com a mesma chave).
 */

const IV_BYTES = 12;

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  // Alocado via ArrayBuffer explícito p/ satisfazer BufferSource sob lib DOM.
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Tipo da chave sem depender do global `CryptoKey` (ausente em lib ES2023).
type AesKey = Awaited<ReturnType<typeof globalThis.crypto.subtle.importKey>>;

/** Deriva uma chave AES-256-GCM a partir do segredo via SHA-256. */
async function deriveKey(keySecret: string): Promise<AesKey> {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(keySecret),
  );
  return globalThis.crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/** Cifra uma string; retorna `base64(iv).base64(ciphertext)`. */
export async function encryptSecret(plain: string, keySecret: string): Promise<string> {
  const key = await deriveKey(keySecret);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plain),
  );
  return `${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`;
}

/** Decifra o formato produzido por `encryptSecret`. Lança em chave/entrada inválida. */
export async function decryptSecret(enc: string, keySecret: string): Promise<string> {
  const dot = enc.indexOf('.');
  if (dot <= 0 || dot === enc.length - 1) {
    throw new Error('decryptSecret: formato inválido — esperado "base64(iv).base64(ciphertext)".');
  }
  const iv = fromBase64(enc.slice(0, dot));
  const ciphertext = fromBase64(enc.slice(dot + 1));
  const key = await deriveKey(keySecret);
  const plain = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(plain);
}
