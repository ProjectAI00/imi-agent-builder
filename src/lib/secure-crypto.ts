import crypto from 'crypto'

// Simple AES-256-GCM helpers using a 32-byte key from env
const getKey = () => {
  const raw = process.env.CAPTURE_ENCRYPTION_KEY || process.env.BETTER_AUTH_SECRET || ''
  if (!raw) throw new Error('Missing CAPTURE_ENCRYPTION_KEY (32+ bytes recommended)')
  // Derive a 32-byte key from provided secret via SHA-256
  return crypto.createHash('sha256').update(raw).digest()
}

export function encryptJson(obj: any) {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const plaintext = Buffer.from(JSON.stringify(obj), 'utf8')
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: enc.toString('base64'),
  }
}

export function decryptJson(payload: { iv: string; tag: string; data: string }) {
  const key = getKey()
  const iv = Buffer.from(payload.iv, 'base64')
  const tag = Buffer.from(payload.tag, 'base64')
  const data = Buffer.from(payload.data, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(data), decipher.final()])
  return JSON.parse(dec.toString('utf8'))
}

