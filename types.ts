/** Defines types used across main, renderer, and scraper processes. */

// --- Input/Output Types ---

export interface InputRow {
    BaseName: string;
    URL: string;
    CSSSelector?: string;
    XPathSelector?: string;
    [key: string]: string | undefined; // For other optional columns
}

export interface ScrapeResult {
    ScreenshotFile: string; // Relative path
    LogoFile: string;       // Relative path
    ScrapedData: string;    // JSON string of scraped key-value pairs
    Status: 'SUCCESS' | 'ERROR' | 'SKIPPED' | 'DUPLICATE';
    ErrorMessage: string;
}

export type OutputRow = InputRow & ScrapeResult;

// --- Configuration Types ---

export interface ScraperConfig {
    inputCsvPath: string;
    outputDirPath: string;
    imageSubFolder: string;
    selectors: {
        css: string; // Comma-separated or newline-separated
        xpath: string;
    };
    useAISmartScrape: boolean;
    concurrency: number;
    aiApiKey: string; // For the AI Smart Scrape module
}

// --- Scraper/IPC Types ---

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface LogMessage {
    level: LogLevel;
    message: string;
    timestamp: number;
}

export interface ProgressUpdate {
    processed: number;
    total: number;
    status: string;
    logs: LogMessage[];
}

export type ScrapeMap = Map<string, ScrapeResult>; // Key is the unique URL