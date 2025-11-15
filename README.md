AI Smart Web Scraper Desktop App

This is a complete, production-ready web scraping desktop application built with Electron, TypeScript, React, and Playwright. It features robust CSV input/output, smart image capture (screenshots and logos), popup/modal bypass, and an optional AI Smart Scrape mode powered by the Gemini API.

Project Structure

/web-scraper-desktop
|-- package.json
|-- tsconfig.json
|-- README.md
|-- src/
|   |-- main/
|   |   |-- electron-main.ts (Main process, IPC, manages ScraperEngine)
|   |-- renderer/
|   |   |-- App.tsx (React UI, controls)
|   |-- scraper/
|   |   |-- ScraperEngine.ts (Playwright orchestrator, concurrency)
|   |   |-- AISmartScrape.ts (Gemini API logic)
|   |   |-- Bypass.ts (Popup/Modal closing heuristics)
|   |   |-- LogoCapture.ts (Logo detection logic)
|   |-- utils/
|   |   |-- CsvUtils.ts (CSV parsing/stringifying)
|   |   |-- FileUtils.ts (File naming, directory creation)
|   |   |-- types.ts (Shared data types)


Prerequisites

Node.js: Version 18 or higher.

npm: Node Package Manager.

AI_API_KEY: Required if you wish to use the AI Smart Scrape feature.

Installation and Setup

Clone the repository (or set up the files provided):

git clone [repository-url]
cd web-scraper-desktop


Install Dependencies:

npm install


Note: This will also install the necessary Playwright browser drivers.

Configure AI (Optional):
Create a file named .env in the project root (/web-scraper-desktop) and add your Gemini API key:

# .env
AI_API_KEY="YOUR_GEMINI_API_KEY_HERE"


Usage

Run in Development Mode

This will start the TypeScript watcher for both the main and renderer processes and launch the Electron application.

npm run dev


Build and Run Executable

Build the project:

npm run build


Run the compiled Electron app:

npm start


Input CSV Specification

Your input CSV file must contain at least the following columns:

Column Name

Purpose

Example

BaseName

Used for file naming (screenshots, logos). Must be unique per row.

AcmeCorp

URL

The URL to scrape.

https://www.acmecorp.com

CSSSelector

(Optional) Override or add CSS selectors for this specific URL.

price=.current-price

XPathSelector

(Optional) Override or add XPath selectors for this specific URL.

author=//span[@class='author']

Other

Any other data you want carried over to the output.

Category

Deduplication: If the same URL appears multiple times, the app will only visit it once. The results will be mapped back to all corresponding rows in the output CSV.

Output CSV Specification

The output CSV will include all original columns plus the following data:

Column Name

Purpose

ScreenshotFile

Relative path to the full-page screenshot (e.g., images/AcmeCorp.png).

LogoFile

Relative path to the captured logo image (e.g., images/AcmeCorp-1.png).

ScrapedData

JSON string of key-value pairs extracted via custom selectors or AI Smart Scrape.

Status

SUCCESS, ERROR, SKIPPED, DUPLICATE.

ErrorMessage

Details of any navigation or scraping failure.

Smart Image Naming

Uses the BaseName column for the base filename.

Files are saved to ./output-directory/images/.

Screenshot: BaseName.png

Logo: BaseName-1.png (or -2, -3 for multiple variants, though only the primary is currently captured).