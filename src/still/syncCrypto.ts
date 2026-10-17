const bytes = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
const base64 = (data: Uint8Array) => {
  let text = '';
  for (let i = 0; i < data.length; i += 8192) text += String.fromCharCode(...data.subarray(i, i + 8192));
  return btoa(text);
};
async function key(passphrase: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}
export async function sealSnapshot(content: string, passphrase: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await key(passphrase, salt),
    new TextEncoder().encode(content)
  );
  return JSON.stringify({
    format: 'still-sync-v1',
    salt: base64(salt),
    iv: base64(iv),
    data: base64(new Uint8Array(encrypted)),
  });
}
export async function openSnapshot(content: string, passphrase: string) {
  try {
    const envelope = JSON.parse(content);
    if (
      envelope.format !== 'still-sync-v1' ||
      typeof envelope.salt !== 'string' ||
      typeof envelope.iv !== 'string' ||
      typeof envelope.data !== 'string'
    )
      throw new Error();
    const salt = bytes(envelope.salt);
    const iv = bytes(envelope.iv);
    if (salt.length !== 16 || iv.length !== 12) throw new Error();
    return new TextDecoder('utf-8', { fatal: true }).decode(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await key(passphrase, salt), bytes(envelope.data))
    );
  } catch {
    throw new Error(
      'Cannot decrypt Still sync snapshot. Check the encryption passphrase; local data has not been replaced.'
    );
  }
}
