const { ipcMain, app } = require('electron')
const fs = require('fs')
const path = require('path')
const https = require('https')

// Fill this in after creating your Gumroad product (Settings → Advanced → Product ID)
const GUMROAD_PRODUCT_ID = 'YOUR_GUMROAD_PRODUCT_ID'

const LICENSE_FILE = path.join(app.getPath('userData'), 'sholly-license.json')

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

function verifyWithGumroad(licenseKey) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      product_id: GUMROAD_PRODUCT_ID,
      license_key: licenseKey.trim(),
      increment_uses_count: 'false',
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

  ipcMain.handle('license:activate', async (_event, licenseKey) => {
    if (!licenseKey?.trim()) return { success: false, error: 'Please enter a license key.' }

    // In dev mode accept any non-empty key so you can work without a real key
    if (!app.isPackaged) {
      const data = { key: licenseKey.trim(), activatedAt: new Date().toISOString(), email: 'dev@local' }
      writeLicense(data)
      return { success: true, ...data }
    }

    try {
      const result = await verifyWithGumroad(licenseKey)
      if (!result.success) {
        return { success: false, error: 'Invalid license key. Please check and try again.' }
      }
      const data = {
        key: licenseKey.trim(),
        activatedAt: new Date().toISOString(),
        email: result.purchase?.email || '',
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
