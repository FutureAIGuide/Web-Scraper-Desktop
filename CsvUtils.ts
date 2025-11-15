import * as fs from 'fs';
import * as Papa from 'papaparse'; // Simulating use of PapaParse (or similar)
import { InputRow, OutputRow, ScrapeMap } from './types';

// Utility function to simulate file-safe name generation
function toFileSafeName(name: string): string {
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

/** Parses the input CSV and deduplicates by URL. */
export function parseInputCsv(filePath: string): {
    uniqueUrls: Map<string, InputRow>; // Unique URLs mapped to the *first* input row
    inputRows: InputRow[]; // All original input rows
} {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const parseResult = Papa.parse<InputRow>(fileContent, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            transformHeader: (header) => header.trim(),
            transform: (value, field) => {
                if (typeof value === 'string') return value.trim();
                return value;
            }
        });

        if (parseResult.errors.length > 0) {
            throw new Error(`CSV Parsing Error: ${parseResult.errors[0].message}`);
        }

        const inputRows: InputRow[] = parseResult.data.map(row => ({
            BaseName: String(row.BaseName || 'untitled'),
            URL: String(row.URL || ''),
            CSSSelector: row.CSSSelector ? String(row.CSSSelector) : undefined,
            XPathSelector: row.XPathSelector ? String(row.XPathSelector) : undefined,
            ...row // Include all other columns
        }));

        const uniqueUrls = new Map<string, InputRow>();
        
        for (const row of inputRows) {
            if (row.URL && !uniqueUrls.has(row.URL)) {
                uniqueUrls.set(row.URL, row);
            }
        }

        return { uniqueUrls, inputRows };

    } catch (error) {
        console.error('Failed to parse CSV:', error);
        throw new Error(`Could not process CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/** Generates the final output CSV content from original rows and scrape results. */
export function generateOutputCsv(inputRows: InputRow[], scrapeResults: ScrapeMap): string {
    const outputRows: OutputRow[] = [];
    const allHeaders = new Set<string>();

    // Collect all unique headers from input rows
    inputRows.forEach(row => Object.keys(row).forEach(header => allHeaders.add(header)));
    
    // Add required output headers
    ['ScreenshotFile', 'LogoFile', 'ScrapedData', 'Status', 'ErrorMessage'].forEach(header => allHeaders.add(header));
    
    const finalHeaders = Array.from(allHeaders);

    for (const row of inputRows) {
        const result = scrapeResults.get(row.URL);

        let outputRow: Partial<OutputRow> = { ...row };

        if (result) {
            outputRow = {
                ...outputRow,
                ...result,
            };
        } else {
            // Should not happen if logic is correct, but safe fallback
            outputRow = {
                ...outputRow,
                Status: 'ERROR',
                ErrorMessage: 'Internal error: URL not found in results map.'
            };
        }

        // Fill in missing headers with empty strings to ensure consistency
        const completeRow: any = {};
        for (const header of finalHeaders) {
            completeRow[header] = outputRow[header as keyof Partial<OutputRow>] || '';
        }

        outputRows.push(completeRow as OutputRow);
    }
    
    // Use PapaParse to stringify the array of objects
    return Papa.unparse(outputRows, {
        header: true,
        quotes: true
    });
}