// ============================================================
// WebFinger - Crypto Utilities
// API Key 安全存储（使用 Web Crypto API 本地加密）
// ============================================================

const ALGORITHM = 'AES-GCM' as const;
const KEY_NAME = 'webfinger-encryption-key';

/** 获取或创建加密密钥 */
async function getEncryptionKey(): Promise<CryptoKey> {
  // 先尝试从 IndexedDB 获取已有密钥
  const existing = await getStoredKey();
  if (existing) return existing;

  // 生成新密钥
  const key = await crypto.subtle.generateKey(
    { name: ALGORITHM, length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  await storeKey(key);
  return key;
}

/** 从 storage 中获取已存储的密钥 */
async function getStoredKey(): Promise<CryptoKey | null> {
  try {
    const result = await browser.storage.local.get(KEY_NAME);
    if (!result[KEY_NAME]) return null;

    const jwk = JSON.parse(result[KEY_NAME]);
    return crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: ALGORITHM, length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  } catch {
    return null;
  }
}

/** 存储密钥 */
async function storeKey(key: CryptoKey): Promise<void> {
  const jwk = await crypto.subtle.exportKey('jwk', key);
  await browser.storage.local.set({ [KEY_NAME]: JSON.stringify(jwk) });
}

/** 加密 API Key */
export async function encryptApiKey(plainText: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plainText);

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded
  );

  // 将 IV + 密文合并为单个字符串
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/** 解密 API Key */
export async function decryptApiKey(cipherText: string): Promise<string> {
  const key = await getEncryptionKey();
  const combined = Uint8Array.from(atob(cipherText), (c) => c.charCodeAt(0));

  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    encrypted
  );

  return new TextDecoder().decode(decrypted);
}
