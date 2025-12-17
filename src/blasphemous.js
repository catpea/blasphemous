#!/usr/bin/env node

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { opt, dir, readJson } from './lib/util.js';

import mergebase from './cmd/mergebase.js';
import permalink from './cmd/permalink.js';
import pagerizer from './cmd/pagerizer.js';
import homepages from './cmd/homepages.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const options = opt({
  src: join(root, 'samples/sources/my-blog'),
  dest: join(root, 'samples/destinations'),
});

const { src, dest } = options;

console.time('execution time');

// Discover all destination folders (exclude 'static' folder - it's for global assets)
const allDirs = await dir(dest);
const destinations = allDirs.filter(d => !d.endsWith('/static'));

// Build each destination
for (const destination of destinations) {
  const destName = destination.split('/').pop();
  console.log(`\n📦 Building: ${destName}`);

  const destOptions = await readJson(join(destination, 'options.json')).catch(() => ({}));

  console.log('  📁 Merging static assets...');
  await mergebase({ src, dest: destination, ...destOptions.mergebase });

  console.log('  🔗 Creating permalinks...');
  const posts = await permalink({ src, dest: destination, ...destOptions.permalink }, destOptions /* for inner commands */);

  console.log('  📄 Generating pages...');
  await pagerizer({ src, dest: destination, ...destOptions.pagerizer });

  console.log('  🏠 Building homepage...');
  await homepages({ src, dest: destination, ...destOptions.homepages });

  console.log(`  ✓ Built ${posts.length} posts`);
}

console.log('\n✨ All destinations built successfully\n');
console.timeEnd('execution time');
