import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerFileHandlers } from './ipc/fileHandlers';
import { registerConfigHandlers } from './ipc/configHandlers';
import { registerDialogHandlers } from './ipc/dialogHandlers';
import { IPC_CHANNELS } from '../shared/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
    backgroundColor: '#09090b',
  });

  // Load the app
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register IPC handlers
function registerHandlers() {
  registerFileHandlers(ipcMain);
  registerConfigHandlers(ipcMain);
  registerDialogHandlers(ipcMain);

  // App-level handlers
  ipcMain.handle(IPC_CHANNELS.APP_GET_USER_DATA_PATH, () => {
    return { success: true, data: app.getPath('userData') };
  });

  ipcMain.handle(IPC_CHANNELS.APP_GET_HOME_PATH, () => {
    return { success: true, data: app.getPath('home') };
  });

  ipcMain.handle(IPC_CHANNELS.APP_OPEN_EXTERNAL, async (_event, url: string) => {
    await shell.openExternal(url);
    return { success: true };
  });
}

app.whenReady().then(() => {
  registerHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
