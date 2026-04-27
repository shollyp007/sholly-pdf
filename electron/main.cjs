const { app, BrowserWindow, ipcMain, dialog, Menu, shell, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const { autoUpdater } = require('electron-updater')

// ── Auto-updater setup ─────────────────────────────────────────────────────────
autoUpdater.autoDownload = false          // don't download silently; ask user first
autoUpdater.autoInstallOnAppQuit = false  // we'll prompt instead
autoUpdater.logger = null                 // suppress noisy console logs

// Track whether the check was user-initiated (via Help menu) or silent (background)
let userInitiatedCheck = false

autoUpdater.on('update-available', (info) => {
  mainWindow?.webContents.send('updater:available', info)
  userInitiatedCheck = false
})
autoUpdater.on('update-not-available', () => {
  // Only notify the UI if the user explicitly asked
  if (userInitiatedCheck) mainWindow?.webContents.send('updater:not-available')
  userInitiatedCheck = false
})
autoUpdater.on('error', (err) => {
  // Only surface errors to the user if they initiated the check themselves
  if (userInitiatedCheck) mainWindow?.webContents.send('updater:error', err.message)
  userInitiatedCheck = false
})
autoUpdater.on('download-progress', (p) => {
  mainWindow?.webContents.send('updater:progress', Math.round(p.percent))
})
autoUpdater.on('update-downloaded', (info) => {
  mainWindow?.webContents.send('updater:downloaded', info)
})

const isDev = !app.isPackaged

let mainWindow

// ── Open-with / drag-to-dock file queue ────────────────────────────────────────
let pendingFileOpen = null
app.on('open-file', (event, filePath) => {
  event.preventDefault()
  if (mainWindow && mainWindow.webContents) {
    sendOpenFile(filePath)
  } else {
    pendingFileOpen = filePath
  }
})

function sendOpenFile(filePath) {
  try {
    const buffer = Array.from(fs.readFileSync(filePath))
    mainWindow?.webContents.send('menu:open-file', {
      name: path.basename(filePath),
      filePath,
      buffer,
    })
  } catch (e) {
    console.error('Failed to open file:', e)
  }
}

// ── Window factory ─────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !isDev,
      spellcheck: false,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 14 },
    title: 'Sholly PDF',
    backgroundColor: '#1a1a1a',
    show: false,
    ...(process.platform === 'darwin' && { vibrancy: 'sidebar' }),
  })

  // Prevent navigation away from the app
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('http://localhost') && !url.startsWith('file://')) {
      e.preventDefault()
      shell.openExternal(url)
    }
  })

  // Open all external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (isDev) mainWindow.webContents.openDevTools()

    // Deliver any file that was opened before the window was ready
    if (pendingFileOpen) {
      sendOpenFile(pendingFileOpen)
      pendingFileOpen = null
    }
  })
}

// ── IPC: Native save dialog ───────────────────────────────────────────────────
ipcMain.handle('show-save-dialog', async (_event, opts = {}) => {
  return dialog.showSaveDialog(mainWindow, {
    title: 'Save PDF',
    defaultPath: opts.defaultPath || 'document.pdf',
    filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
  })
})

// ── IPC: Write file to disk ───────────────────────────────────────────────────
ipcMain.handle('write-file', async (_event, { filePath, buffer }) => {
  fs.writeFileSync(filePath, Buffer.from(buffer))
  return true
})

// ── IPC: Open file dialog ─────────────────────────────────────────────────────
ipcMain.handle('show-open-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open PDF',
    filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
    properties: ['openFile'],
  })
  if (result.canceled || !result.filePaths[0]) return null
  const filePath = result.filePaths[0]
  const buffer = Array.from(fs.readFileSync(filePath))
  return { name: path.basename(filePath), filePath, buffer }
})

// ── IPC: Get app version ──────────────────────────────────────────────────────
ipcMain.handle('get-version', () => app.getVersion())

// ── IPC: Auto-updater controls ────────────────────────────────────────────────
ipcMain.handle('updater:check', async () => {
  try {
    userInitiatedCheck = true
    await autoUpdater.checkForUpdates()
  } catch (e) {
    userInitiatedCheck = false
  }
})
ipcMain.handle('updater:download', async () => {
  await autoUpdater.downloadUpdate()
})
ipcMain.handle('updater:install', () => {
  autoUpdater.quitAndInstall()
})

// ── Native app menu ───────────────────────────────────────────────────────────
function buildMenu() {
  const sendToRenderer = (channel) => () => mainWindow?.webContents.send(channel)

  const template = [
    ...(process.platform === 'darwin' ? [{
      label: 'Sholly PDF',
      submenu: [
        {
          label: 'About Sholly PDF',
          click: () => {
            app.setAboutPanelOptions({
              applicationName: 'Sholly PDF',
              applicationVersion: app.getVersion(),
              version: '',
              copyright: 'Copyright © 2025 Sholly PDF',
              website: 'https://github.com',
            })
            app.showAboutPanel()
          },
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Document', accelerator: 'CmdOrCtrl+N', click: sendToRenderer('menu:new') },
        {
          label: 'Open PDF…',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
              properties: ['openFile'],
            })
            if (result.canceled || !result.filePaths[0]) return
            const fp = result.filePaths[0]
            const buf = Array.from(fs.readFileSync(fp))
            mainWindow?.webContents.send('menu:open-file', { name: path.basename(fp), filePath: fp, buffer: buf })
          },
        },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: sendToRenderer('menu:save') },
        { type: 'separator' },
        { label: 'Print…', accelerator: 'CmdOrCtrl+P', click: () => mainWindow?.webContents.print() },
        ...(process.platform !== 'darwin' ? [
          { type: 'separator' },
          {
            label: 'About Sholly PDF',
            click: () => {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'About Sholly PDF',
                message: 'Sholly PDF',
                detail: `Version ${app.getVersion()}\nCopyright © 2025 Sholly PDF`,
                buttons: ['OK'],
              })
            },
          },
          { type: 'separator' },
          { role: 'quit' },
        ] : []),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: sendToRenderer('menu:zoom-in') },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: sendToRenderer('menu:zoom-out') },
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', click: sendToRenderer('menu:zoom-reset') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'Toggle Pages Panel', accelerator: 'CmdOrCtrl+\\', click: sendToRenderer('menu:toggle-left') },
        ...(isDev ? [{ type: 'separator' }, { role: 'reload' }, { role: 'toggleDevTools' }] : []),
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Keyboard Shortcuts', click: sendToRenderer('menu:shortcuts') },
        { type: 'separator' },
        {
          label: 'Check for Updates…',
          click: async () => {
            mainWindow?.webContents.send('menu:check-updates')
            try {
              userInitiatedCheck = true
              await autoUpdater.checkForUpdates()
            } catch (e) {
              userInitiatedCheck = false
            }
          },
        },
        { type: 'separator' },
        { label: 'Report an Issue', click: () => shell.openExternal('https://github.com') },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ── Handle second-instance (Windows/Linux) ────────────────────────────────────
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
    // Windows passes the file path as a command-line argument
    if (process.platform === 'win32') {
      const filePath = argv.find((arg) => arg.endsWith('.pdf'))
      if (filePath) sendOpenFile(filePath)
    }
  })

  app.whenReady().then(() => {
    // Windows: handle file opened via "Open with" from Explorer
    if (process.platform === 'win32') {
      const filePath = process.argv.find((arg) => arg.endsWith('.pdf'))
      if (filePath) pendingFileOpen = filePath
    }

    createWindow()
    buildMenu()

    // Silently check for updates ~5 s after launch (production only)
    if (!isDev) {
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch(() => {})
      }, 5000)
    }
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
