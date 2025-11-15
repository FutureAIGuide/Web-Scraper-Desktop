import { Page } from 'playwright';
import { LogMessage } from '../utils/types';

// The model to use for generation
const AI_MODEL = 'gemini-2.5-flash-preview-09-2025';

// Define the JSON schema for the expected structured output
const RESPONSE_SCHEMA = {
    type: "OBJECT",
    properties: {
        "siteName": { "type": "STRING", "description": "The official name of the company/website." },
        "mainHeadline": { "type": "STRING", "description": "The main hero or tag line of the page." },
        "phoneNumber": { "type": "STRING", "description": "Any visible phone number on the page." },
        "emailAddress": { "type": "STRING", "description": "Any visible email address." },
        "primaryAddress": { "type": "STRING", "description": "The primary physical address, if visible." }
    },
    "propertyOrdering": ["siteName", "mainHeadline", "phoneNumber", "emailAddress", "primaryAddress"]
};

/**
 * Uses the LLM to infer and extract structured data from the page's HTML content.
 * @returns A JSON string of the structured data, or null on failure.
 */
export async function aiSmartScrape(page: Page, aiApiKey: string, log: (msg: string) => void): Promise<string | null> {
    if (!aiApiKey) {
        log('WARN: AI Smart Scrape skipped. AI_API_KEY is not configured.');
        return null;
    }

    // 1. Fetch relevant, visible HTML content (e.g., body content only)
    let pageHtml: string;
    try {
        pageHtml = await page.evaluate(() => document.body.outerHTML);
        // Truncate for API context limits, focusing on the top part of the body
        pageHtml = pageHtml.substring(0, Math.min(pageHtml.length, 50000));
        log(`Fetched ${pageHtml.length} characters of HTML for AI analysis.`);
    } catch (e) {
        log('ERROR: Could not get page HTML for AI analysis.');
        return null;
    }

    const systemPrompt = `You are an expert web content extraction engine. Analyze the provided HTML and extract the requested fields into the specified JSON format. Return NULL for any field that is not clearly visible in the content. Do not generate text outside the JSON block.`;
    
    const userQuery = `Extract structured data from the following HTML content, paying close attention to visible, meaningful text. HTML: \n\n${pageHtml}`;
    
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${aiApiKey}`;
    
    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA
        }
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            log(`ERROR: AI API request failed with status ${response.status}.`);
            return null;
        }

        const result = await response.json();
        const candidate = result.candidates?.[0];

        if (candidate && candidate.content?.parts?.[0]?.text) {
            const jsonText = candidate.content.parts[0].text;
            log('AI Smart Scrape successful. Data received.');
            // Return the raw JSON string
            return jsonText;
        }

        log('ERROR: AI response was malformed or empty.');
        return null;

    } catch (error) {
        log(`ERROR: AI Smart Scrape failed due to network error or API failure. ${error}`);
        return null;
    }
}