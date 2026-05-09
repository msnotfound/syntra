import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// 32 ASCII chars; override TOKEN_ENCRYPTION_KEY in production
const rawKey = process.env.TOKEN_ENCRYPTION_KEY ?? 'syntra-dev-key-000000000000000000';
const KEY = Buffer.from(rawKey.padEnd(32, '0').slice(0, 32), 'utf8');

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptToken(ciphertext: string): string {
  const [ivHex, encHex] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', KEY, iv);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
