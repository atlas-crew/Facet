import type { FacetWorkspaceSnapshot } from './contracts'
import { assertValidWorkspaceSnapshot } from './validation'

const BACKUP_FORMAT = 'facet-workspace-backup'
const BACKUP_VERSION = 1
const PBKDF2_ITERATIONS = 310000
const AES_KEY_LENGTH = 256
const SALT_BYTES = 16
const IV_BYTES = 12

interface BackupPayload {
  snapshot: FacetWorkspaceSnapshot
}

export interface EncryptedWorkspaceBackupEnvelope {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  algorithm: 'AES-GCM'
  kdf: {
    name: 'PBKDF2'
    hash: 'SHA-256'
    iterations: number
    saltBase64: string
  }
  ivBase64: string
  ciphertextBase64: string
  exportedAt: string
  workspaceId: string
  workspaceName: string
}

const getCrypto = () => {
  if (!globalThis.crypto?.subtle) {
    throw new Error('WebCrypto is not available in this environment.')
  }

  return globalThis.crypto
}

const toBase64 = (bytes: Uint8Array) => {
  let binary = ''
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return btoa(binary)
}

const fromBase64 = (value: string) => {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

const deriveKey = async (passphrase: string, salt: Uint8Array) => {
  const cryptoImpl = getCrypto()
  const passphraseBytes = new TextEncoder().encode(passphrase)
  const keyMaterial = await cryptoImpl.subtle.importKey(
    'raw',
    passphraseBytes,
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return cryptoImpl.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: toArrayBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: AES_KEY_LENGTH,
    },
    false,
    ['encrypt', 'decrypt'],
  )
}

const parseEnvelope = (bundleText: string): EncryptedWorkspaceBackupEnvelope => {
  let parsed: unknown

  try {
    parsed = JSON.parse(bundleText)
  } catch {
    throw new Error('Backup file is not valid JSON.')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Backup file is not a valid encrypted Facet backup.')
  }

  const envelope = parsed as Partial<EncryptedWorkspaceBackupEnvelope>
  if (
    envelope.format !== BACKUP_FORMAT ||
    envelope.version !== BACKUP_VERSION ||
    envelope.algorithm !== 'AES-GCM' ||
    !envelope.kdf ||
    envelope.kdf.name !== 'PBKDF2' ||
    envelope.kdf.hash !== 'SHA-256' ||
    typeof envelope.kdf.iterations !== 'number' ||
    typeof envelope.kdf.saltBase64 !== 'string' ||
    typeof envelope.ivBase64 !== 'string' ||
    typeof envelope.ciphertextBase64 !== 'string' ||
    typeof envelope.exportedAt !== 'string' ||
    typeof envelope.workspaceId !== 'string' ||
    typeof envelope.workspaceName !== 'string'
  ) {
    throw new Error('Backup file is not a valid encrypted Facet backup.')
  }

  return envelope as EncryptedWorkspaceBackupEnvelope
}

const normalizePassphrase = (passphrase: string) => {
  const normalized = passphrase.trim()
  if (normalized.length < 8) {
    throw new Error('Passphrase must be at least 8 characters.')
  }

  return normalized
}

const toArrayBuffer = (bytes: Uint8Array) => Uint8Array.from(bytes).buffer

export const createEncryptedWorkspaceBackup = async (
  snapshot: FacetWorkspaceSnapshot,
  passphrase: string,
): Promise<string> => {
  assertValidWorkspaceSnapshot(snapshot)

  const normalizedPassphrase = normalizePassphrase(passphrase)
  const cryptoImpl = getCrypto()
  const salt = cryptoImpl.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = cryptoImpl.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKey(normalizedPassphrase, salt)
  const payload: BackupPayload = { snapshot }
  const plaintext = new TextEncoder().encode(JSON.stringify(payload))
  const ciphertextBuffer = await cryptoImpl.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
    },
    key,
    plaintext,
  )

  const envelope: EncryptedWorkspaceBackupEnvelope = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    algorithm: 'AES-GCM',
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      saltBase64: toBase64(salt),
    },
    ivBase64: toBase64(iv),
    ciphertextBase64: toBase64(new Uint8Array(ciphertextBuffer)),
    exportedAt: snapshot.exportedAt,
    workspaceId: snapshot.workspace.id,
    workspaceName: snapshot.workspace.name,
  }

  return JSON.stringify(envelope, null, 2)
}

export const decryptEncryptedWorkspaceBackup = async (
  bundleText: string,
  passphrase: string,
): Promise<FacetWorkspaceSnapshot> => {
  const envelope = parseEnvelope(bundleText)
  const normalizedPassphrase = normalizePassphrase(passphrase)
  let plaintext: ArrayBuffer

  try {
    const key = await deriveKey(normalizedPassphrase, fromBase64(envelope.kdf.saltBase64))
    plaintext = await getCrypto().subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: toArrayBuffer(fromBase64(envelope.ivBase64)),
      },
      key,
      toArrayBuffer(fromBase64(envelope.ciphertextBase64)),
    )
  } catch {
    throw new Error('Passphrase is incorrect or the backup file is corrupted.')
  }

  const decoded = new TextDecoder().decode(plaintext)
  const payload = JSON.parse(decoded) as Partial<BackupPayload>
  assertValidWorkspaceSnapshot(payload.snapshot)
  return payload.snapshot
}

export const buildWorkspaceBackupFileName = (
  workspaceName: string,
  exportedAt: string,
  slugifyValue: (value: string) => string,
) => {
  const safeWorkspaceName = slugifyValue(workspaceName) || 'facet-workspace'
  const datePrefix = exportedAt.slice(0, 10)
  return `${safeWorkspaceName}-backup-${datePrefix}.facet.json`
}
