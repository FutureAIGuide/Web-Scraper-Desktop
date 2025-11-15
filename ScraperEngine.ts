import { chromium, Browser, Page } from 'playwright';
import * as path from 'path';
import { ScraperConfig, InputRow, ScrapeMap, ScrapeResult, ProgressUpdate, LogMessage } from '../utils/types';
import { parseInputCsv, generateOutputCsv } from '../utils/CsvUtils';
import { getImagePath, ensureDir } from '../utils/FileUtils';
import { attemptBypass } from './Bypass';
import { captureLogo } from './LogoCapture';
import { aiSmartScrape } from './AISmartScrape';
import * as fs from 'fs';

// IPC communication type (simulated via global function for Electron)
type IpcSender = (update: ProgressUpdate) => void;

export class ScraperEngine {
    private config: ScraperConfig;
    private logMessages: LogMessage[] = [];
    private running = false;
    private ipcSender: IpcSender;
    private browser: Browser | null = null;
    private totalUrls = 0;
    private processedUrls = 0;
    private errorCount = 0;

    constructor(config: ScraperConfig, ipcSender: IpcSender) {
        this.config = config;
        this.ipcSender = ipcSender;
    }

    private log(level: 'INFO' | 'WARN' | 'ERROR', message: string, detail?: string): void {
        const fullMessage = detail ? `${message} (${detail})` : message;
        const msg: LogMessage = { level, message: fullMessage, timestamp: Date.now() };
        this.logMessages.push(msg);

        // Limit log size to prevent memory issues in the GUI
        if (this.logMessages.length > 500) {
            this.logMessages.splice(0, 100);
        }

        this.sendProgress();
        console.log(`[${level}] ${fullMessage}`);
    }

    private sendProgress(status: string = this.running ? 'Running...' : 'Idle'): void {
        const update: ProgressUpdate = {
            processed: this.processedUrls,
            total: this.totalUrls,
            status: status,
            logs: this.logMessages.slice(-50) // Send only the last 50 logs to the GUI
        };
        this.ipcSender(update);
    }

    public async stop(): Promise<void> {
        this.log('INFO', 'Scraping operation cancelled by user.');
        this.running = false;
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
        this.sendProgress('Cancelled');
    }

    public async start(): Promise<string> {
        this.running = true;
        this.logMessages = [];
        this.errorCount = 0;
        this.processedUrls = 0;
        let outputCsvPath = '';
        this.sendProgress('Initializing...');

        try {
            // --- 1. Load and Parse CSV ---
            this.log('INFO', `Loading input CSV from: ${this.config.inputCsvPath}`);
            const { uniqueUrls, inputRows } = parseInputCsv(this.config.inputCsvPath);
            this.totalUrls = uniqueUrls.size;
            this.log('INFO', `Found ${inputRows.length} rows, processing ${this.totalUrls} unique URLs.`);

            // --- 2. Setup Directories and Browser ---
            const imageOutputDir = path.join(this.config.outputDirPath, this.config.imageSubFolder);
            ensureDir(imageOutputDir);
            this.log('INFO', `Output images will be saved to: ${imageOutputDir}`);

            this.browser = await chromium.launch({ headless: true });
            this.log('INFO', 'Playwright browser launched (headless mode).');

            // --- 3. Scrape Unique URLs (Concurrency Management) ---
            const scrapeResults: ScrapeMap = new Map<string, ScrapeResult>();
            const urlEntries = Array.from(uniqueUrls.entries());

            const pool = new Array(Math.min(this.config.concurrency, this.totalUrls)).fill(null).map((_, i) => ({ id: i + 1, task: Promise.resolve() as Promise<any> }));
            let urlIndex = 0;

            const scrapeNext = async (workerId: number) => {
                while (this.running && urlIndex < urlEntries.length) {
                    const [url, firstRow] = urlEntries[urlIndex++];
                    
                    if (!this.running) break;

                    const result = await this.scrapeUrl(workerId, url, firstRow);
                    scrapeResults.set(url, result);
                    this.processedUrls++;
                    if (result.Status === 'ERROR') this.errorCount++;
                    
                    this.sendProgress(`Processing ${this.processedUrls}/${this.totalUrls}...`);
                }
            };
            
            this.log('INFO', `Starting scrape with ${pool.length} concurrent workers.`);
            await Promise.all(pool.map(w => scrapeNext(w.id)));
            
            if (!this.running) {
                this.log('INFO', 'Scraping stopped prematurely.');
                // Generate CSV with partial results
            }


            // --- 4. Map Results Back to All Input Rows ---
            this.log('INFO', 'Mapping results back to all input rows...');

            const finalScrapeMap: ScrapeMap = new Map<string, ScrapeResult>();
            
            // First, process the unique URLs that were scraped
            for (const [url, result] of scrapeResults.entries()) {
                finalScrapeMap.set(url, result);
            }
            
            // Then, handle duplicate URLs
            inputRows.forEach((row, index) => {
                if (index === 0 || !finalScrapeMap.has(row.URL)) return; // Already handled or first instance
                
                const existingResult = scrapeResults.get(row.URL);
                if (existingResult) {
                    finalScrapeMap.set(row.URL, {
                        ...existingResult,
                        Status: 'DUPLICATE',
                        ErrorMessage: 'Result shared from first instance of this URL.'
                    });
                }
            });


            // --- 5. Generate and Save Output CSV ---
            const csvContent = generateOutputCsv(inputRows, finalScrapeMap);
            outputCsvPath = path.join(this.config.outputDirPath, path.basename(this.config.inputCsvPath).replace('.csv', '_output.csv'));
            fs.writeFileSync(outputCsvPath, csvContent, 'utf-8');

            this.log('INFO', `Scraping completed. Total errors: ${this.errorCount}.`);
            this.sendProgress('Completed');

        } catch (error) {
            this.log('ERROR', `Fatal scraping error: ${error instanceof Error ? error.message : String(error)}`);
            this.sendProgress('Error');
        } finally {
            this.running = false;
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }
        }
        return outputCsvPath;
    }

    private async scrapeUrl(workerId: number, url: string, firstRow: InputRow): Promise<ScrapeResult> {
        let page: Page | null = null;
        let result: Partial<ScrapeResult> = {
            ScreenshotFile: '',
            LogoFile: '',
            ScrapedData: '{}',
            Status: 'ERROR',
            ErrorMessage: 'Start of scrape.',
        };
        const baseLog = (level: 'INFO' | 'WARN' | 'ERROR', message: string) => this.log(level, `[Worker ${workerId} - ${firstRow.BaseName}] ${message}`);

        try {
            if (!this.browser) throw new Error('Browser is not initialized.');
            
            baseLog('INFO', `Starting URL: ${url}`);
            page = await this.browser.newPage();
            
            // --- Navigation ---
            await page.goto(url, { waitUntil: 'load', timeout: 30000 });
            await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => baseLog('WARN', 'Page network idle timeout reached. Proceeding.'));

            // --- 1. Popup Bypass ---
            await attemptBypass(page, (msg) => baseLog('INFO', msg));
            
            // --- 2. Full Page Screenshot ---
            const { fullPath: ssFullPath, relativePath: ssRelPath } = getImagePath(this.config.outputDirPath, this.config.imageSubFolder, firstRow.BaseName, 'screenshot');
            await page.screenshot({ path: ssFullPath, fullPage: true });
            baseLog('INFO', `Screenshot captured: ${ssRelPath}`);
            result.ScreenshotFile = ssRelPath;

            // --- 3. Logo Capture ---
            const logoRelPath = await captureLogo(page, firstRow.BaseName, this.config.outputDirPath, this.config.imageSubFolder, (msg) => baseLog('INFO', msg));
            result.LogoFile = logoRelPath || '';

            // --- 4. Data Scraping (Custom Selectors) ---
            let scrapedData: Record<string, any> = {};
            const selectorsProvided = firstRow.CSSSelector || firstRow.XPathSelector || this.config.selectors.css || this.config.selectors.xpath;
            
            if (selectorsProvided) {
                scrapedData = await this.scrapeCustomData(page, firstRow, baseLog);
                baseLog('INFO', 'Data scraped using custom selectors.');
            } else if (this.config.useAISmartScrape) {
                // --- 5. AI Smart Scrape ---
                const aiResultJson = await aiSmartScrape(page, this.config.aiApiKey, (msg) => baseLog('INFO', msg));
                if (aiResultJson) {
                    result.ScrapedData = aiResultJson;
                    baseLog('INFO', 'Data scraped using AI Smart Scrape.');
                }
            }
            
            // Only set ScrapedData from custom selectors if AI wasn't used/successful
            if (Object.keys(scrapedData).length > 0) {
                result.ScrapedData = JSON.stringify(scrapedData);
            }
            
            // Final success status
            result.Status = 'SUCCESS';
            result.ErrorMessage = '';

        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            baseLog('ERROR', `Scrape Failed for ${url}: ${msg}`);
            result.ErrorMessage = msg;
            result.Status = 'ERROR';
        } finally {
            if (page) {
                await page.close();
            }
            return result as ScrapeResult;
        }
    }
    
    /** Handles scraping data using provided CSS/XPath selectors. */
    private async scrapeCustomData(page: Page, row: InputRow, baseLog: (level: 'INFO' | 'WARN' | 'ERROR', message: string) => void): Promise<Record<string, any>> {
        const data: Record<string, any> = {};

        // Combine selectors from input row and global config
        const cssSelectors = (row.CSSSelector || this.config.selectors.css).split(',').map(s => s.trim()).filter(s => s);
        const xpathSelectors = (row.XPathSelector || this.config.selectors.xpath).split(',').map(s => s.trim()).filter(s => s);

        const allSelectors = [
            ...cssSelectors.map(s => ({ type: 'css', selector: s })),
            ...xpathSelectors.map(s => ({ type: 'xpath', selector: s }))
        ];
        
        for (const { type, selector } of allSelectors) {
            const [name, query] = selector.includes('=') ? selector.split('=', 2).map(s => s.trim()) : ['data', selector];
            
            if (!query) continue;

            try {
                const locator = type === 'css' ? page.locator(query) : page.locator(`xpath=${query}`);
                const element = await locator.first();
                const text = await element.textContent();

                if (text) {
                    data[name] = text.trim();
                } else {
                    baseLog('WARN', `Selector for ${name} (${query}) found element but text content was empty.`);
                }
            } catch (e) {
                baseLog('WARN', `Selector for ${name} (${query}) not found or failed to extract.`);
                data[name] = null;
            }
        }

        return data;
    }
}