/**
 * One-time: calls ProviderRegistry.setAgentTabContract(agentTabAddress)
 * Uses raw Circle API (same path as the compass-deploy script internals).
 * Run: bun run scripts/wire-registry.ts
 */
import { encodeFunctionData } from 'viem'
import { randomUUID } from 'node:crypto'

const apiKey       = process.env.CIRCLE_API_KEY!
const entitySecret = process.env.CIRCLE_ENTITY_SECRET!
if (!apiKey || !entitySecret) { console.error('Missing CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET'); process.exit(1) }

const WALLET_ID      = '8637a885-2d64-5e45-9cf0-8eb4ff6ecfcb'
const REGISTRY_ADDR  = '0x7Aee569e097758B3f102ab3e96b91001200BBCF9'
const AGENT_TAB_ADDR = '0x65C57be611bEeA856d30f887FD423BA67Cc814f3'
const BASE           = 'https://api.circle.com'

const calldata = encodeFunctionData({
  abi: [{ name: 'setAgentTabContract', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'addr', type: 'address' }], outputs: [] }],
  functionName: 'setAgentTabContract',
  args: [AGENT_TAB_ADDR as `0x${string}`],
})

async function circlePost(path: string, body: unknown) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await r.json()
  if (!r.ok) throw new Error(`Circle API ${r.status}: ${JSON.stringify(json)}`)
  return json
}

async function circleGet(path: string) {
  const r = await fetch(`${BASE}${path}`, { headers: { 'Authorization': `Bearer ${apiKey}` } })
  const json = await r.json()
  if (!r.ok) throw new Error(`Circle API ${r.status}: ${JSON.stringify(json)}`)
  return json
}

// Step 1: build entity secret ciphertext for this request
// The SDK does this; here we replicate it using the public key from /v1/w3s/config/entity
console.log('Fetching entity public key...')
const entityConfig = await circleGet('/v1/w3s/config/entity/publicKey')
const publicKeyPem = entityConfig?.data?.publicKey
if (!publicKeyPem) { console.error('No public key returned:', JSON.stringify(entityConfig)); process.exit(1) }

// Encrypt entity secret with Circle's RSA-OAEP public key
import { createPublicKey, publicEncrypt, constants } from 'node:crypto'
const pubKey = createPublicKey(publicKeyPem)
const secretBuf = Buffer.from(entitySecret, 'hex')
const ciphertext = publicEncrypt(
  { key: pubKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
  secretBuf,
).toString('base64')

console.log(`Calling ProviderRegistry(${REGISTRY_ADDR}).setAgentTabContract(${AGENT_TAB_ADDR})...`)

const submitResp = await circlePost('/v1/w3s/developer/transactions/contractExecution', {
  idempotencyKey: randomUUID(),
  walletId: WALLET_ID,
  contractAddress: REGISTRY_ADDR,
  callData: calldata,
  blockchain: 'ARC',
  entitySecretCiphertext: ciphertext,
  feeLevel: 'MEDIUM',
})

const txId = submitResp?.data?.id
if (!txId) { console.error('No tx id:', JSON.stringify(submitResp)); process.exit(1) }
console.log('Submitted, polling tx id:', txId)

const TERMINAL = ['COMPLETE', 'CONFIRMED', 'FAILED', 'CANCELLED', 'DENIED', 'ERROR']
for (let i = 1; i <= 90; i++) {
  await new Promise(r => setTimeout(r, 3000))
  const tx = await circleGet(`/v1/w3s/transactions/${txId}`)
  const state  = tx?.data?.transaction?.state  ?? 'UNKNOWN'
  const txHash = tx?.data?.transaction?.txHash ?? ''
  console.log(`  [${i}/90] state: ${state}${txHash ? '  hash: ' + txHash : ''}`)
  if (TERMINAL.includes(state)) {
    if (['COMPLETE', 'CONFIRMED'].includes(state)) {
      console.log('SUCCESS — setAgentTabContract confirmed.')
      console.log('  txHash:', txHash)
      console.log('  Explorer: https://explorer.arc.io/tx/' + txHash)
    } else {
      console.error('FAILED — final state:', state)
      process.exit(1)
    }
    process.exit(0)
  }
}
console.error('Timed out')
process.exit(1)
