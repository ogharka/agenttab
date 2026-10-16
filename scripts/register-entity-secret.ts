/**
 * One-time entity secret registration for Circle developer-controlled wallets.
 * Run with: bun run scripts/register-entity-secret.ts
 * The secret value is NEVER printed to stdout.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { registerEntitySecretCiphertext, initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'

const apiKey = process.env.CIRCLE_API_KEY
if (!apiKey) {
  console.error('ERROR: CIRCLE_API_KEY is not set in .env')
  process.exit(1)
}

// Generate a cryptographically random 32-byte secret — never printed
const entitySecret = crypto.randomBytes(32).toString('hex')
console.log('Generated entity secret (length check):', entitySecret.length, 'hex chars — value not shown')

// Ensure recovery directory exists under /home/user/app so it is downloadable
const recoveryDir = '/home/user/app/.circle'
fs.mkdirSync(recoveryDir, { recursive: true })

console.log('Registering entity secret ciphertext with Circle...')
let response
try {
  response = await registerEntitySecretCiphertext({
    apiKey,
    entitySecret,
    recoveryFileDownloadPath: recoveryDir,
  })
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('Registration failed:', msg)
  process.exit(1)
}

// Write recovery file if the SDK did not already persist it
const recoveryPath = path.join(recoveryDir, 'recovery_file.dat')
if (response.data?.recoveryFile && !fs.existsSync(recoveryPath)) {
  fs.writeFileSync(recoveryPath, response.data.recoveryFile, 'utf-8')
}

if (!fs.existsSync(recoveryPath)) {
  console.error('ERROR: Recovery file was not written to', recoveryPath)
  process.exit(1)
}
console.log('Recovery file written to:', recoveryPath)

// Append secret to .env — never log the value
const envPath = path.join('/home/user/app', '.env')
fs.appendFileSync(envPath, `\nCIRCLE_ENTITY_SECRET=${entitySecret}\n`, 'utf-8')
console.log('CIRCLE_ENTITY_SECRET appended to .env (value hidden)')

// Verify registration with a read-only call
console.log('Verifying registration...')
try {
  const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret })
  await client.listWalletSets({ pageSize: 1 })
  console.log('Verification SUCCESS — entity secret is registered and working.')
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('Verification failed:', msg)
  process.exit(1)
}

console.log('DONE. Back up BOTH artifacts now:')
console.log('  1. CIRCLE_ENTITY_SECRET value from .env (copy to password manager)')
console.log('  2. Recovery file:', recoveryPath, '(download from Code panel file tree)')
