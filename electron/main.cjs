const { app, BrowserWindow, ipcMain, dialog, session } = require('electron')
const path = require('path')
const fs = require('fs/promises')
const fsSync = require('fs')

const isDev = process.env.NODE_ENV === 'development';

const CONFIG_PATH = path.join(app.getPath('userData'), 'privdo-config.json');

// Only set via the native select-directory dialog — never from the renderer directly
let currentStoragePath = null;

async function getConfig() {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { storagePath: null, pinHash: null };
  }
}

async function saveConfig(config) {
  const current = await getConfig();
  await fs.writeFile(CONFIG_PATH, JSON.stringify({ ...current, ...config }, null, 2));
}

function validateFilePath(filePath) {
  if (!currentStoragePath) {
    throw new Error('No storage path configured');
  }
  const resolved = path.resolve(filePath).normalize('NFC');
  const resolvedStorage = path.resolve(currentStoragePath).normalize('NFC');
  if (!resolved.startsWith(resolvedStorage + path.sep) && resolved !== resolvedStorage) {
    throw new Error('Access denied: path is outside the configured storage directory');
  }

  // Resolve symlinks to prevent TOCTOU bypass
  try {
    const realPath = fsSync.realpathSync(resolved).normalize('NFC');
    const realStorage = fsSync.realpathSync(resolvedStorage).normalize('NFC');
    if (!realPath.startsWith(realStorage + path.sep) && realPath !== realStorage) {
      throw new Error('Access denied: symlink target is outside storage directory');
    }
    return realPath;
  } catch (err) {
    if (err.code === 'ENOENT') {
      // File doesn't exist yet (write-file creating new file) — validate parent
      const parentDir = path.dirname(resolved);
      try {
        const realParent = fsSync.realpathSync(parentDir).normalize('NFC');
        const realStorage = fsSync.realpathSync(resolvedStorage).normalize('NFC');
        if (!realParent.startsWith(realStorage + path.sep) && realParent !== realStorage) {
          throw new Error('Access denied: parent directory is outside storage');
        }
      } catch (parentErr) {
        if (parentErr.code === 'ENOENT') {
          throw new Error('Access denied: parent directory does not exist');
        }
        throw parentErr;
      }
      return resolved;
    }
    throw err;
  }
}

function createWindow () {
  const win = new BrowserWindow({
    width: 800,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'preload.cjs')
    }
  })

  // Block navigation away from the app origin
  win.webContents.on('will-navigate', (event, url) => {
    const appOrigin = isDev ? 'http://localhost:5173' : 'file://';
    if (!url.startsWith(appOrigin)) {
      event.preventDefault();
    }
  });

  // Block new window creation (e.g. target="_blank" links)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(async () => {
  // Set Content-Security-Policy headers
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const csp = isDev
      ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' ws://localhost:* https://*.supabase.co; img-src 'self' data:; object-src 'none'; base-uri 'self';"
      : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co; img-src 'self' data:; object-src 'none'; base-uri 'self';";
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    });
  });

  const config = await getConfig();
  currentStoragePath = config.storagePath || null;

  ipcMain.handle('get-config', async () => {
    return await getConfig();
  });

  ipcMain.handle('save-config', async (event, config) => {
    // Never allow the renderer to set storagePath — only the native dialog can do that.
    // A compromised renderer could otherwise point storagePath at /etc, ~/.ssh, etc.
    const { storagePath: _ignored, ...safeConfig } = config;
    await saveConfig(safeConfig);
    return true;
  });

  ipcMain.handle('select-directory', async (event) => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled) return null;
    const selected = result.filePaths[0];
    // Only the native dialog can set the storage path
    currentStoragePath = selected;
    await saveConfig({ storagePath: selected });
    return selected;
  });

  ipcMain.handle('read-file', async (event, filePath) => {
    try {
      const safePath = validateFilePath(filePath);
      return await fs.readFile(safePath, 'utf-8');
    } catch {
      return null;
    }
  });

  ipcMain.handle('write-file', async (event, filePath, content) => {
    const safePath = validateFilePath(filePath);
    await fs.writeFile(safePath, content, 'utf-8');
    return true;
  });

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
