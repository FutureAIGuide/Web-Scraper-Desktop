import { Page } from 'playwright';
import { LogMessage } from '../utils/types';

const COMMON_POPUP_SELECTORS = [
    // Cookie banners (Accept buttons)
    'text=/accept|i agree|ok|got it/i',
    '[class*="cookie"] button',
    '[id*="cookie"] button',
    // Newsletter/Modal Close buttons
    '[aria-label*="close"]',
    '[class*="modal-close"]',
    '[class*="popup-close"]',
    '[class*="dismiss"]',
    'button[title*="Close"]',
    'button:has-text("No thanks")',
    // Overlays (sometimes removing the overlay works better)
    'div[style*="position: fixed"][style*="z-index: 9999"]',
    'div[id*="backdrop"]',
];

/** Tries to dismiss common popups and overlays on the page. */
export async function attemptBypass(page: Page, log: (msg: string) => void): Promise<void> {
    log('Attempting to bypass common popups and overlays...');

    for (const selector of COMMON_POPUP_SELECTORS) {
        try {
            // Find visible element
            const element = await page.locator(selector).first();
            const boundingBox = await element.boundingBox();

            if (boundingBox && element) {
                const tag = await element.evaluate(el => el.tagName);

                if (tag === 'BUTTON' || tag === 'A' || selector.includes('text=')) {
                    // Clicks the element if it's a button/link/text-based
                    log(`Bypassing by clicking selector: ${selector.substring(0, 50)}`);
                    await element.click({ timeout: 500 }); // Short timeout for clicking
                    await page.waitForTimeout(500); // Wait for animation/state change
                } else if (tag === 'DIV' || tag === 'SECTION') {
                    // Remove large fixed overlays
                    log(`Bypassing by hiding overlay: ${selector.substring(0, 50)}`);
                    await element.evaluate(el => {
                        el.remove();
                        // Also try to remove any body overflow lock
                        document.body.style.overflow = 'auto';
                    });
                }
            }
        } catch (e) {
            // Element not found or click failed (expected behavior for most selectors)
        }
    }

    log('Popup bypass attempts finished.');
}