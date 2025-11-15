import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ScraperConfig, ProgressUpdate, LogMessage } from '../utils/types';

// The following import was removed to fix the "Could not resolve" error:
// import './index.css'; 

// Shim window.electronAPI type for TypeScript in the renderer
declare global {
    interface Window {
        electronAPI: {
            selectFile: (options: any) => Promise<string | null>;
            selectDir: () => Promise<string | null>;
            startScrape: (config: ScraperConfig) => Promise<string>;
            stopScrape: () => Promise<string>;
            onScrapeUpdate: (callback: (update: ProgressUpdate) => void) => void;
            offScrapeUpdate: (callback: (update: ProgressUpdate) => void) => void;
        }
    }
}

const DEFAULT_CONFIG: Partial<ScraperConfig> = {
    imageSubFolder: 'images',
    selectors: { css: 'productName=.product-title, price=.price-value', xpath: '' },
    useAISmartScrape: false,
    concurrency: 3,
};

// Simple utility function to get current directory for default output path
const getCwd = () => {
    // In a real Electron app, you'd use path.dirname(__dirname) etc.
    // For this environment, we'll use a placeholder
    return window.electronAPI ? '.' : '/path/to/project';
};

const LogPanel: React.FC<{ logs: LogMessage[] }> = ({ logs }) => {
    const logEndRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs.length]);

    const getLogColor = (level: LogMessage['level']) => {
        switch (level) {
            case 'ERROR': return 'text-red-600 bg-red-50';
            case 'WARN': return 'text-yellow-600 bg-yellow-50';
            case 'INFO': return 'text-gray-700 bg-gray-50';
            default: return 'text-gray-700';
        }
    };

    return (
        <div className="bg-white p-3 rounded-lg border border-gray-200 h-64 overflow-y-scroll font-mono text-xs">
            {logs.map((log, index) => (
                <div key={index} className={`flex gap-2 ${getLogColor(log.level)} p-0.5 rounded-sm`}>
                    <span className="w-16 font-bold">{log.level}</span>
                    <span className="flex-1">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className="flex-[3]">{log.message}</span>
                </div>
            ))}
            <div ref={logEndRef} />
        </div>
    );
};

const App: React.FC = () => {
    const [inputCsvPath, setInputCsvPath] = useState('');
    const [outputDirPath, setOutputDirPath] = useState(getCwd());
    const [selectors, setSelectors] = useState(DEFAULT_CONFIG.selectors!);
    const [useAISmartScrape, setUseAISmartScrape] = useState(DEFAULT_CONFIG.useAISmartScrape!);
    const [concurrency, setConcurrency] = useState(DEFAULT_CONFIG.concurrency!);
    const [isScraping, setIsScraping] = useState(false);
    const [progress, setProgress] = useState<ProgressUpdate>({ processed: 0, total: 0, status: 'Idle', logs: [] });
    const [finalMessage, setFinalMessage] = useState<string>('');
    const [errorSummary, setErrorSummary] = useState<string>('');

    // --- IPC & Progress Handling ---
    const updateHandler = useCallback((update: ProgressUpdate) => {
        setProgress(update);
    }, []);

    useEffect(() => {
        if (window.electronAPI) {
            window.electronAPI.onScrapeUpdate(updateHandler);
        }
        return () => {
            if (window.electronAPI) {
                window.electronAPI.offScrapeUpdate(updateHandler);
            }
        };
    }, [updateHandler]);
    
    // --- File Dialogs ---
    const handleSelectCsv = async () => {
        if (!window.electronAPI) return;
        const filePath = await window.electronAPI.selectFile({
            filters: [{ name: 'CSV Files', extensions: ['csv'] }],
            properties: ['openFile']
        });
        if (filePath) {
            setInputCsvPath(filePath);
            setOutputDirPath(path.dirname(filePath)); // Set output to parent folder of input
        }
    };

    const handleSelectDir = async () => {
        if (!window.electronAPI) return;
        const dirPath = await window.electronAPI.selectDir();
        if (dirPath) {
            setOutputDirPath(dirPath);
        }
    };

    // --- Core Actions ---
    const handleStartScrape = async () => {
        if (!inputCsvPath) {
            setErrorSummary('Please select an input CSV file first.');
            return;
        }
        if (!outputDirPath) {
            setErrorSummary('Please select an output directory.');
            return;
        }

        setIsScraping(true);
        setFinalMessage('');
        setErrorSummary('');
        setProgress({ processed: 0, total: 0, status: 'Running...', logs: [] });

        const config: ScraperConfig = {
            inputCsvPath,
            outputDirPath,
            imageSubFolder: DEFAULT_CONFIG.imageSubFolder!,
            selectors,
            useAISmartScrape,
            concurrency,
            aiApiKey: '' // Will be populated in the main process from .env
        };

        try {
            const finalPath = await window.electronAPI.startScrape(config);
            setFinalMessage(`Scraping completed successfully! Output CSV saved to: ${finalPath}`);
            const errorCount = progress.logs.filter(l => l.level === 'ERROR').length;
            if (errorCount > 0) {
                setErrorSummary(`${errorCount} URL(s) failed. Check the log below and the output CSV for details.`);
            } else {
                setErrorSummary('No errors reported.');
            }
        } catch (e: any) {
            setErrorSummary(`Fatal Error: ${e.message}`);
            setProgress(p => ({ ...p, status: 'Error' }));
        } finally {
            setIsScraping(false);
        }
    };

    const handleStopScrape = async () => {
        if (!window.electronAPI) return;
        await window.electronAPI.stopScrape();
        setIsScraping(false);
        setFinalMessage('Scraping stopped by user.');
        setProgress(p => ({ ...p, status: 'Stopped' }));
    };
    
    // UI rendering helpers
    const progressPercent = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;
    const progressStatus = progress.total > 0 ? `${progress.processed}/${progress.total} URLs Processed` : '0/0 URLs';


    return (
        <div className="min-h-screen p-6 bg-gray-50 flex flex-col gap-6">
            <h1 className="text-3xl font-extrabold text-blue-800 border-b pb-2 mb-4">AI Smart Web Scraper</h1>

            {/* Configuration Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 p-5 bg-white rounded-xl shadow-lg flex flex-col gap-4 border border-blue-200">
                    <h2 className="text-xl font-semibold text-blue-700">1. Input/Output</h2>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Input CSV File</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={inputCsvPath || 'No file selected...'}
                                readOnly
                                className="flex-1 p-2 border border-gray-300 rounded-lg bg-gray-50 text-xs"
                            />
                            <button onClick={handleSelectCsv} disabled={isScraping} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition duration-150">
                                Select CSV
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Output Directory</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={outputDirPath}
                                readOnly
                                className="flex-1 p-2 border border-gray-300 rounded-lg bg-gray-50 text-xs"
                            />
                            <button onClick={handleSelectDir} disabled={isScraping} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition duration-150">
                                Select Dir
                            </button>
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Concurrency (Max Parallel Pages)</label>
                        <input
                            type="number"
                            min="1"
                            max="10"
                            value={concurrency}
                            onChange={(e) => setConcurrency(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                            disabled={isScraping}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>

                <div className="lg:col-span-2 p-5 bg-white rounded-xl shadow-lg flex flex-col gap-4 border border-blue-200">
                    <h2 className="text-xl font-semibold text-blue-700">2. Selector Configuration</h2>

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">CSS Selectors (name=query, name2=query2, ...)</label>
                            <textarea
                                value={selectors.css}
                                onChange={(e) => setSelectors({ ...selectors, css: e.target.value })}
                                disabled={isScraping}
                                rows={4}
                                className="w-full p-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-blue-500 focus:border-blue-500"
                                placeholder="e.g., title=h1.main-title, price=.product-price"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">XPath Selectors (name=query, ...)</label>
                            <textarea
                                value={selectors.xpath}
                                onChange={(e) => setSelectors({ ...selectors, xpath: e.target.value })}
                                disabled={isScraping}
                                rows={4}
                                className="w-full p-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-blue-500 focus:border-blue-500"
                                placeholder="e.g., author=//span[@itemprop='author']"
                            />
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-blue-50">
                        <span className="text-base font-medium text-blue-800">Use AI Smart Scrape</span>
                        <div 
                            className={`w-14 h-8 flex items-center rounded-full p-1 cursor-pointer transition-colors ${useAISmartScrape ? 'bg-green-500' : 'bg-gray-300'}`}
                            onClick={() => setUseAISmartScrape(!useAISmartScrape)}
                        >
                            <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform ${useAISmartScrape ? 'translate-x-6' : 'translate-x-0'}`} />
                        </div>
                    </div>
                    <p className="text-xs text-gray-500">
                        <span className="font-semibold">AI Note:</span> When enabled and no custom selectors are provided for a URL, the app will use the Gemini API (requires `AI_API_KEY` in `.env` file) to automatically extract site name, headline, contact info, etc.
                    </p>
                </div>
            </div>

            {/* Controls & Status */}
            <div className="p-5 bg-white rounded-xl shadow-lg border border-blue-200">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex gap-4">
                        <button
                            onClick={handleStartScrape}
                            disabled={isScraping || !inputCsvPath}
                            className={`px-8 py-3 rounded-xl text-white font-bold transition duration-300 ${
                                isScraping 
                                    ? 'bg-gray-400 cursor-not-allowed' 
                                    : 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200'
                            }`}
                        >
                            {isScraping ? 'Scraping...' : 'Start Scrape'}
                        </button>
                        <button
                            onClick={handleStopScrape}
                            disabled={!isScraping}
                            className={`px-8 py-3 rounded-xl text-white font-bold transition duration-300 ${
                                isScraping 
                                    ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-200' 
                                    : 'bg-gray-400 cursor-not-allowed'
                            }`}
                        >
                            Cancel / Stop
                        </button>
                    </div>
                    <span className={`text-2xl font-extrabold ${isScraping ? 'text-blue-600 animate-pulse' : progress.status === 'Completed' ? 'text-green-600' : 'text-gray-500'}`}>
                        Status: {progress.status}
                    </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                    <div
                        className="bg-blue-600 h-4 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                    ></div>
                </div>
                <div className="flex justify-between text-sm font-medium text-gray-700">
                    <span>{progressStatus}</span>
                    <span>{progressPercent}% Complete</span>
                </div>
                
                {/* Final Messages */}
                {finalMessage && (
                    <p className="mt-4 p-3 bg-green-100 border border-green-300 text-green-800 rounded-lg font-medium">
                        {finalMessage}
                    </p>
                )}
                {errorSummary && (
                    <p className={`mt-2 p-3 ${progress.status === 'Error' ? 'bg-red-100 border-red-300 text-red-800' : 'bg-yellow-100 border-yellow-300 text-yellow-800'} border rounded-lg font-medium`}>
                        {errorSummary}
                    </p>
                )}
            </div>
            
            {/* Log Panel */}
            <div className="flex-1 p-5 bg-white rounded-xl shadow-lg border border-blue-200">
                <h2 className="text-xl font-semibold text-blue-700 mb-2">3. Activity Log</h2>
                <LogPanel logs={progress.logs} />
            </div>

        </div>
    );
};

// Ensure React is mounted to the root element
import ReactDOM from 'react-dom/client';
import * as path from 'path';

// Define the path object stub for use in the renderer process (simulating Electron global)
const path = {
    dirname: (p: string) => p.substring(0, p.lastIndexOf('/')),
    join: (...parts: string[]) => parts.join('/'),
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
