# Web-Scraper-Desktop
An Electron desktop app for web scraping with AI intelligence, supporting CSV I/O, Playwright, and screenshot capture.

## Tech Stack

- **Electron** - Desktop application framework
- **React** - UI library for renderer process
- **TypeScript** - Type-safe JavaScript
- **Webpack** - Module bundler
- **Tailwind CSS** - Utility-first CSS framework
- **Playwright** - Browser automation library

## Getting Started

### Installation

```bash
npm install
```

### Development

Build the application:
```bash
npm run build
```

Run the application:
```bash
npm start
```

Watch mode for renderer (development):
```bash
npm run dev
```

## Project Structure

```
.
├── src/
│   ├── main.ts              # Electron main process
│   └── renderer/
│       ├── index.html       # HTML entry point
│       ├── index.tsx        # React entry point
│       ├── App.tsx          # Main React component
│       └── styles.css       # Tailwind CSS styles
├── dist/                    # Build output
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript config for renderer
├── tsconfig.main.json       # TypeScript config for main process
├── webpack.config.js        # Webpack configuration
├── tailwind.config.js       # Tailwind CSS configuration
└── postcss.config.js        # PostCSS configuration
```
