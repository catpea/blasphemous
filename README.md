# Blasphemous
**Clear And Fast Blog Builder**

A static site generator built on the Unix philosophy: one command does one thing well.

## Philosophy

After complexity comes simplicity. This is what you get when you've learned that elegance beats cleverness, that four beautiful `await` commands are worth more than a thousand classes.

## Architecture

```javascript
await mergebase({ src, dest })  // Copy static assets
await permalink({ src, dest })  // Create permalink folders
await pagerizer({ src, dest })  // Generate page-001.html, page-002.html...
await homepages({ src, dest })  // Build index.html with featured posts
```

That's it. That's the whole builder. Four commands you can understand in 20 years.

## Structure

### Sources
```
samples/sources/my-blog/db/
├── philosophy/          # Your "books" - categories of content
│   ├── chapter-001/
│   │   ├── post-000/
│   │   │   ├── options.json    # Post metadata
│   │   │   ├── text.md         # Post content
│   │   │   ├── cover.jpg       # Cover image
│   │   │   ├── audio.mp3       # Optional audio
│   │   │   └── files/          # Extra files (apps, images, etc.)
│   │   └── post-001/
│   └── chapter-002/
└── technology/
    └── ...
```

### Destinations
```
samples/destinations/
├── static/                     # Global assets (merged to ALL destinations)
│   └── favicon.ico
├── nekoweb-account-main/       # Destination for Nekoweb (500MB limit)
│   ├── options.json            # Command defaults for this destination
│   ├── static/                 # Destination-specific assets
│   └── wwwroot/                # Generated output
└── gh-pages-account1/          # Destination for GitHub Pages
    └── ...
```

## Usage

```bash
# Build all destinations
npm run build

# Or directly
node src/commands/blasphemous.js
```

## Options

Each destination has an `options.json` file with command defaults:

```json
{
  "permalink": { "dir": "permalinks" },
  "pagerizer": {
    "perpage": 12,
    "filename": "page-${nnn}.html"
  },
  "homepages": {
    "recentCount": 12,
    "featureTags": ["app", "music", "fancy"]
  }
}
```

## Multiple Destinations

Build once, deploy everywhere with different compression settings:

- **Cloudflare Pages**: 20,000 file limit → last 3 chapters only
- **Nekoweb**: 500MB limit → heavy compression
- **GitHub Pages**: 5GB limit → full content
- **Bitbucket Mirror**: Backup with moderate compression

## Commands

Each command is a standalone module that does one thing:

- **mergebase**: Copies static files from global and destination-specific folders
- **permalink**: Creates UUID-based permalink folders for each post
- **pagerizer**: Generates paginated archive pages
- **homepages**: Builds index.html with featured and recent posts

## Future Features

- Incremental builds with SQLite state tracking
- AVIF image compression
- AM radio quality MP3 compression
- Watch mode with file system observers
- Unix socket communication for live updates

## License

MIT
