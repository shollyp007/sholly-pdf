const { ipcMain, app, shell } = require('electron')
const fs = require('fs')
const path = require('path')
const https = require('https')
const crypto = require('crypto')

// Fill this in after creating your Gumroad product (Settings → Advanced → Product ID)
const GUMROAD_PRODUCT_ID = 'YOUR_GUMROAD_PRODUCT_ID'

// Offline master keys that activate without contacting Gumroad — for your own copy and
// to hand-issue licenses before the Gumroad product is live. Only SHA-256 *hashes* are
// stored here so the real keys never appear in the (public) source. To add a key, run:
//   node -e "console.log(require('crypto').createHash('sha256').update('YOUR-KEY').digest('hex'))"
// and paste the hash below.
const OWNER_KEY_HASHES = ['242cc2dc81da6ca68cb0355e5875585d823b04a0a464a3e19b0692c705e1e8c3']

function isOwnerKey(key) {
  const hash = crypto.createHash('sha256').update(key).digest('hex')
  return OWNER_KEY_HASHES.includes(hash)
}

// Where the "Purchase a license" button sends people. Update to your Gumroad product page.
const PURCHASE_URL = 'https://shollyp007.gumroad.com/l/sholly-pdf'

// Free trial length before activation is required.
const TRIAL_DAYS = 3
const DAY_MS = 24 * 60 * 60 * 1000

// How many machines a single license key may be activated on.
const SEAT_LIMIT = 2

const LICENSE_FILE = path.join(app.getPath('userData'), 'sholly-license.json')
const TRIAL_FILE = path.join(app.getPath('userData'), 'sholly-trial.json')
const DEVICE_FILE = path.join(app.getPath('userData'), 'sholly-device.json')

// Stable per-machine id, generated once and reused. Recorded with the license so
// activations can be identified for support.
function getDeviceId() {
  try {
    const d = JSON.parse(fs.readFileSync(DEVICE_FILE, 'utf8'))
    if (d.id) return d.id
  } catch {}
  const id = crypto.randomUUID()
  try { fs.writeFileSync(DEVICE_FILE, JSON.stringify({ id })) } catch {}
  return id
}

function readLicense() {
  try { return JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8')) }
  catch { return null }
}

function writeLicense(data) {
  fs.writeFileSync(LICENSE_FILE, JSON.stringify(data, null, 2))
}

function removeLicense() {
  try { fs.unlinkSync(LICENSE_FILE) } catch {}
}

// ── Free trial ────────────────────────────────────────────────────────────────
// The first launch records a start timestamp; the trial runs for TRIAL_DAYS.
function getTrialStart() {
  try {
    const data = JSON.parse(fs.readFileSync(TRIAL_FILE, 'utf8'))
    if (typeof data.startedAt === 'number') return data.startedAt
  } catch {}
  const startedAt = Date.now()
  try { fs.writeFileSync(TRIAL_FILE, JSON.stringify({ startedAt }, null, 2)) } catch {}
  return startedAt
}

function getTrialStatus() {
  const startedAt = getTrialStart()
  const expiresAt = startedAt + TRIAL_DAYS * DAY_MS
  const msLeft = expiresAt - Date.now()
  const active = msLeft > 0
  const daysLeft = active ? Math.max(1, Math.ceil(msLeft / DAY_MS)) : 0
  return { active, daysLeft, expiresAt, totalDays: TRIAL_DAYS }
}

// Combined entitlement: licensed (paid) OR within the free trial.
function getStatus() {
  const lic = readLicense()
  const licensed = !!(lic && lic.key)
  return {
    licensed,
    email: lic?.email || '',
    trial: getTrialStatus(),
  }
}

function verifyWithGumroad(licenseKey, increment) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      product_id: GUMROAD_PRODUCT_ID,
      license_key: licenseKey.trim(),
      increment_uses_count: increment ? 'true' : 'false',
    }).toString()

    const req = https.request({
      hostname: 'api.gumroad.com',
      path: '/v2/licenses/verify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { reject(new Error('Invalid response from license server')) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function registerLicenseIpc() {
  ipcMain.handle('license:check', () => readLicense())

  // Returns { licensed, email, trial: { active, daysLeft, expiresAt, totalDays } }.
  ipcMain.handle('license:status', () => getStatus())

  // Open the purchase page in the user's default browser.
  ipcMain.handle('license:open-purchase', () => { shell.openExternal(PURCHASE_URL); return true })

  ipcMain.handle('license:activate', async (_event, licenseKey) => {
    const trimmed = licenseKey?.trim()
    if (!trimmed) return { success: false, error: 'Please enter a license key.' }

    // Offline owner/master keys activate immediately, no network needed.
    if (isOwnerKey(trimmed)) {
      const data = { key: trimmed, activatedAt: new Date().toISOString(), email: 'owner@local', source: 'owner' }
      writeLicense(data)
      return { success: true, ...data }
    }

    // In dev mode accept any non-empty key so you can work without a real key
    if (!app.isPackaged) {
      const data = { key: trimmed, activatedAt: new Date().toISOString(), email: 'dev@local' }
      writeLicense(data)
      return { success: true, ...data }
    }

    try {
      // 1) Validate the key WITHOUT consuming a seat, and read the current device count.
      const check = await verifyWithGumroad(trimmed, false)
      if (!check.success) {
        return { success: false, error: 'Invalid license key. Please check and try again.' }
      }
      const purchase = check.purchase || {}
      if (purchase.refunded || purchase.chargebacked || purchase.disputed) {
        return { success: false, error: 'This license was refunded or disputed and is no longer valid.' }
      }
      // 2) Enforce the per-key device limit using Gumroad's server-side uses count.
      const uses = typeof check.uses === 'number' ? check.uses : 0
      if (uses >= SEAT_LIMIT) {
        return { success: false, error: `This key is already in use on ${SEAT_LIMIT} devices. Email support to free a slot.` }
      }
      // 3) Claim a seat (increments the count), then store the license locally.
      await verifyWithGumroad(trimmed, true)
      const data = {
        key: trimmed,
        activatedAt: new Date().toISOString(),
        email: purchase.email || '',
        deviceId: getDeviceId(),
        source: 'gumroad',
      }
      writeLicense(data)
      return { success: true, ...data }
    } catch {
      return { success: false, error: 'Could not reach the license server. Check your internet connection.' }
    }
  })

  ipcMain.handle('license:deactivate', () => {
    removeLicense()
    return true
  })
}

module.exports = { registerLicenseIpc }
