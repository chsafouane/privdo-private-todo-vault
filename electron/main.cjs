const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs/promises')

const isDev = process.env.NODE_ENV === 'development';

const CONFIG_PATH = path.join(app.getPath('userData'), 'privdo-config.json');

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
  const resolved = path.resolve(filePath);
  const resolvedStorage = path.resolve(currentStoragePath);
  if (!resolved.startsWith(resolvedStorage + path.sep) && resolved !== resolvedStorage) {
    throw new Error('Access denied: path is outside the configured storage directory');
  }
  return resolved;
}

function createWindow () {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(async () => {
  const config = await getConfig();
  currentStoragePath = config.storagePath || null;

  ipcMain.handle('get-config', async () => {
    return await getConfig();
  });

  ipcMain.handle('save-config', async (event, config) => {
    await saveConfig(config);
    if (config.storagePath !== undefined) {
      currentStoragePath = config.storagePath;
    }
    return true;
  });

  ipcMain.handle('select-directory', async (event) => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled) return null;
    return result.filePaths[0];
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
