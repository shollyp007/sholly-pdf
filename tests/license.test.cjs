const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')
const { EventEmitter } = require('node:events')
const source = fs.readFileSync(require('node:path').join(__dirname, '../electron/license.cjs'), 'utf8')
function harness(responses) {
  const handlers = {}, writes = [], requests = [], opened = []
  const sandbox = { module: { exports: {} }, URLSearchParams, Buffer, require(name) {
    if (name === 'electron') return { ipcMain: { handle: (key, fn) => { handlers[key] = fn } }, app: { isPackaged: true, getPath: () => '/test' }, shell: { openExternal: url => opened.push(url) } }
    if (name === 'fs') return { readFileSync() { throw new Error('missing') }, writeFileSync: (file, data) => writes.push({ file, data }) }
    if (name === 'https') return { request(options, callback) {
      const req = new EventEmitter()
      req.write = body => requests.push(new URLSearchParams(body))
      req.end = () => { const res = new EventEmitter(); callback(res); res.emit('data', JSON.stringify(responses.shift())); res.emit('end') }
      return req
    } }
    return require(name)
  } }
  vm.runInNewContext(source, sandbox)
  sandbox.module.exports.registerLicenseIpc()
  return { handlers, writes, requests, opened }
}
const valid = uses => ({ success: true, uses, purchase: { email: 'buyer@example.com' } })
test('purchase opens the actual product page', () => {
  const h = harness([]); h.handlers['license:open-purchase']()
  assert.equal(h.opened[0], 'https://adeaga2.gumroad.com/l/pefsolk')
})
test('packaged activation verifies the product and saves only after successful claim', async () => {
  const h = harness([valid(0), valid(1)])
  assert.equal((await h.handlers['license:activate'](null, 'test-key')).success, true)
  assert.equal(h.requests.length, 2)
  assert.equal(h.requests[0].get('product_id'), 'QoA3nYEgAb0tXVsNwu2qzw==')
  assert.equal(h.requests[0].get('increment_uses_count'), 'false')
  assert.equal(h.requests[1].get('increment_uses_count'), 'true')
  assert.ok(h.writes.some(w => w.file.endsWith('sholly-license.json')))
})
for (const [label, responses] of [
  ['invalid key', [{ success: false }]],
  ['refunded purchase', [{ ...valid(0), purchase: { refunded: true } }]],
  ['seat limit', [valid(2)]],
  ['rejected claim', [valid(0), { success: false }]],
  ['claim missing purchase', [valid(0), { success: true, uses: 1 }]],
  ['claim over limit', [valid(1), valid(3)]],
  ['claim disputed', [valid(0), { ...valid(1), purchase: { disputed: true } }]],
]) test(label + ' cannot save a license', async () => {
  const h = harness(responses)
  assert.equal((await h.handlers['license:activate'](null, 'test-key')).success, false)
  assert.equal(h.writes.length, 0)
})
