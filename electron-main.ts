import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { ScraperEngine } from '../scraper/ScraperEngine';
import { ScraperConfig, ProgressUpdate } from '../utils/types';
import * as dotenv from 'dotenv';

// Load environment variables for AI_API_KEY
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

let mainWindow: BrowserWindow | null = null;
let scraperEngine: ScraperEngine | null = null;
let isScraping = false;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            // Ensure necessary Node.js modules are available for the main process
            // (fs, path, etc. used in ScraperEngine)
        },
        title: 'AI Smart Web Scraper'
    });

    // In a production setup, load the bundled file
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Open the DevTools.
    // mainWindow.webContents.openDevTools();
    
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Minimal preload script to expose IPC handlers securely
app.once('ready', () => {
    // Create a minimal preload script dynamically or load a static one
    const preloadPath = path.join(__dirname, 'preload.js');
    if (!fs.existsSync(preloadPath)) {
        fs.writeFileSync(preloadPath, `
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectFile: (options) => ipcRenderer.invoke('dialog:selectFile', options),
    selectDir: () => ipcRenderer.invoke('dialog:selectDir'),
    startScrape: (config) => ipcRenderer.invoke('scraper:start', config),
    stopScrape: () => ipcRenderer.invoke('scraper:stop'),
    onScrapeUpdate: (callback) => ipcRenderer.on('scraper:update', (event, value) => callback(value)),
    offScrapeUpdate: (callback) => ipcRenderer.removeListener('scraper:update', callback),
});
        `, 'utf-8');
    }
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});


// --- IPC Handlers ---

ipcMain.handle('dialog:selectFile', async (event, options) => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('dialog:selectDir', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory', 'createDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('scraper:start', async (event, config: ScraperConfig) => {
    if (isScraping) {
        return 'ALREADY_RUNNING';
    }
    isScraping = true;
    
    // Inject AI Key from environment
    config.aiApiKey = process.env.AI_API_KEY || '';

    // IPC Sender function for the engine to report progress
    const ipcSender = (update: ProgressUpdate) => {
        if (mainWindow) {
            mainWindow.webContents.send('scraper:update', update);
        }
    };

    scraperEngine = new ScraperEngine(config, ipcSender);
    
    try {
        const finalPath = await scraperEngine.start();
        isScraping = false;
        return finalPath; // Return final output path
    } catch (error) {
        isScraping = false;
        throw error;
    }
});

ipcMain.handle('scraper:stop', async () => {
    if (scraperEngine && isScraping) {
        await scraperEngine.stop();
        isScraping = false;
        return 'STOPPED';
    }
    return 'NOT_RUNNING';
});