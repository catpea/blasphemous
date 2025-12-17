import { join, basename } from 'path';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { discoverPosts } from '../lib/util.js';

import { cp, stat, hasExpired, diff } from '../lib/wise.js';

import postpages from './postpages.js';

export default async function permalink({ src, dest, dir = 'permalink', ...options }) {

  const dbPath = join(src, 'db');
  const posts = await discoverPosts(dbPath);

  const permalinkRoot = join(dest, 'wwwroot', dir);
  await mkdir(permalinkRoot, { recursive: true });

  for (const post of posts) {

    if (post.draft) continue;

    // Ensure dicrectory
    const permalinkDir = join(permalinkRoot, post.guid);
    await mkdir(permalinkDir, { recursive: true });

    // Copy files directory
    const filesPath = join(post.path, 'files');
    if (existsSync(filesPath)) await cp(filesPath, join(permalinkDir, 'files'), { recursive: true });

    await cp(join(post.path, 'cover.jpg'), join(permalinkDir, 'cover.jpg'));
    await cp(join(post.path, 'audio.mp3'), join(permalinkDir, 'audio.mp3'));

    const productPath = join(permalinkDir, 'index.html');
    const contentPath = join(post.path, 'text.md');
    const contextPath = join(post.path, 'post.json');

    if ( await hasExpired(productPath, [contentPath, contextPath]) ){
      await postpages( contentPath, contextPath, productPath, post );
    }

  }

  return posts;
}
