const { contextBridge, ipcRenderer } = require('electron')

// Expose safe Electron APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // File dialogs
  showSaveDialog: (opts) => ipcRenderer.invoke('show-save-dialog', opts),
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
  writeFile: (filePath, buffer) => ipcRenderer.invoke('write-file', { filePath, buffer }),

  // App info
  getVersion: () => ipcRenderer.invoke('get-version'),

  // Menu events (renderer listens, main sends)
  onMenuNew:          (cb) => ipcRenderer.on('menu:new',           () => cb()),
  onMenuOpenFile:     (cb) => ipcRenderer.on('menu:open-file',     (_e, data) => cb(data)),
  onMenuSave:         (cb) => ipcRenderer.on('menu:save',          () => cb()),
  onMenuZoomIn:       (cb) => ipcRenderer.on('menu:zoom-in',       () => cb()),
  onMenuZoomOut:      (cb) => ipcRenderer.on('menu:zoom-out',      () => cb()),
  onMenuZoomReset:    (cb) => ipcRenderer.on('menu:zoom-reset',    () => cb()),
  onMenuToggleLeft:   (cb) => ipcRenderer.on('menu:toggle-left',   () => cb()),
  onMenuCheckUpdates: (cb) => ipcRenderer.on('menu:check-updates', () => cb()),
  onBeforeClose:      (cb) => ipcRenderer.on('app:before-close',  () => cb()),
  confirmClose: () => ipcRenderer.send('app:confirm-close'),

  // Auto-updater
  updater: {
    check:    () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install:  () => ipcRenderer.invoke('updater:install'),
    onAvailable:    (cb) => ipcRenderer.on('updater:available',     (_e, info) => cb(info)),
    onNotAvailable: (cb) => ipcRenderer.on('updater:not-available', () => cb()),
    onError:        (cb) => ipcRenderer.on('updater:error',         (_e, msg) => cb(msg)),
    onProgress:     (cb) => ipcRenderer.on('updater:progress',      (_e, pct) => cb(pct)),
    onDownloaded:   (cb) => ipcRenderer.on('updater:downloaded',    (_e, info) => cb(info)),
  },

  // License
  license: {
    check:      () => ipcRenderer.invoke('license:check'),
    activate:   (key) => ipcRenderer.invoke('license:activate', key),
    deactivate: () => ipcRenderer.invoke('license:deactivate'),
  },

  // Platform info
  platform: process.platform,
  isElectron: true,
})
