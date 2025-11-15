import { Page, ElementHandle } from 'playwright';
import { toFileSafeName, getImagePath, ensureDir } from '../utils/FileUtils';
import * as path from 'path';

const LOGO_HEURISTICS_SELECTORS = [
    // 1. Semantic clues (alt/aria/class/id) near the header
    'header :is(img, svg)[alt*="logo" i], header :is(img, svg)[class*="logo" i]',
    'header :is(img, svg)[id*="logo" i], header :is(img, svg)[aria-label*="logo" i]',
    // 2. Common logo container classes/IDs anywhere
    '[class*="brand-logo" i], [id*="header-logo" i], [class*="site-logo" i]',
    // 3. Image/SVG links near the top of the page
    'body > header img, body > .nav img, body > .header img',
];

/**
 * Attempts to find and capture the primary site logo.
 * @returns The relative path to the logo file, or null if not found.
 */
export async function captureLogo(page: Page, baseName: string, outputDir: string, imageSubFolder: string, log: (msg: string) => void): Promise<string | null> {
    log('Attempting to find and capture primary logo...');

    let logoElement: ElementHandle<SVGElement | HTMLElement> | null = null;
    
    for (const selector of LOGO_HEURISTICS_SELECTORS) {
        try {
            const elements = await page.$$(selector);
            // Prioritize the first element found, assuming it's the main logo
            if (elements.length > 0) {
                logoElement = elements[0];
                log(`Logo candidate found with selector: ${selector.substring(0, 50)}`);
                break;
            }
        } catch (e) {
            // Selector failed to find anything or parse error
        }
    }

    if (!logoElement) {
        log('No primary logo element found using heuristics.');
        return null;
    }

    try {
        const { fullPath, relativePath } = getImagePath(outputDir, imageSubFolder, baseName, 'logo', 1);
        ensureDir(path.join(outputDir, imageSubFolder));
        
        // Use element.screenshot for a cropped capture of the logo element
        await logoElement.screenshot({ path: fullPath });
        
        log(`Logo captured successfully: ${relativePath}`);
        return relativePath;
    } catch (error) {
        log(`WARN: Failed to capture logo screenshot. ${error}`);
        return null;
    }
}