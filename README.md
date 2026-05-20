Create README.md in the project root.

Content:

# TabGlider

A Chrome extension for managing multiple tab profiles.
Save, restore, and switch between named sets of tabs and tab groups instantly.

## Features

- Multiple tab profiles with automatic saving
- Full Chrome tab group support (colors, names, collapsed state)
- Window position and size restore
- Recently Closed tabs with LRU history
- Quick Switcher overlay (Ctrl+Shift+Space)
- Markdown export/import for profiles
- Privacy-first: all data stored locally, no accounts

## Development

### Prerequisites
- Node.js 18+
- npm

### Setup
npm install

### Build
npm run build

### Test
npm test

Load the dist/ folder as an unpacked extension in Chrome (chrome://extensions/).

## Stack

- Svelte 5 + TypeScript
- Vite + @crxjs/vite-plugin
- Manifest V3

## License

MIT
