import React from 'react';
import './styles.css';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-blue-600 mb-4">
          Web Scraper Desktop
        </h1>
        <p className="text-lg text-gray-700">
          An Electron desktop app for web scraping with AI intelligence
        </p>
      </div>
    </div>
  );
};

export default App;
