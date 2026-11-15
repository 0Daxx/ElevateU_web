const decodeHex = (value) => {
  if (!/^[\da-f]{64}$/i.test(value || '')) throw new Error('KEY_ENCRYPTION_SECRET must be exactly 64 hexadecimal characters.');
  return Uint8Array.from(value.match(/.{2}/g), (part) => Number.parseInt(part, 16));
};

const toBase64 = (bytes) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

async function getCryptoKey(secret, usage) {
  return crypto.subtle.importKey('raw', decodeHex(secret), { name: 'AES-GCM' }, false, [usage]);
}

export async function encryptApiKey(plaintext, secret, context = '') {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getCryptoKey(secret, 'encrypt');
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128, additionalData: new TextEncoder().encode(context) }, key, new TextEncoder().encode(plaintext)));
  const tagLength = 16;
  return {
    encrypted_key: toBase64(encrypted.slice(0, -tagLength)),
    iv: toBase64(iv),
    auth_tag: toBase64(encrypted.slice(-tagLength)),
  };
}

export async function decryptApiKey(row, secret, context = '') {
  const key = await getCryptoKey(secret, 'decrypt');
  const encrypted = new Uint8Array([...fromBase64(row.encrypted_key), ...fromBase64(row.auth_tag)]);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(row.iv), tagLength: 128, additionalData: new TextEncoder().encode(context) }, key, encrypted);
  return new TextDecoder().decode(decrypted);
}
