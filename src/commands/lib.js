import fs from 'fs';
import path from 'path';
import { readFile, readdir, access, stat } from 'node:fs/promises';
import { argv } from 'node:process';
const TIME_UNITS = [ ['year', 365 * 24 * 60 * 60 * 1000], ['month', 30 * 24 * 60 * 60 * 1000], ['day', 24 * 60 * 60 * 1000], ['hour', 60 * 60 * 1000], ['minute', 60 * 1000], ['second', 1000], ]

export const interpol = (t, c) => t.replace(/\${([^}]+)}/g,(m,p)=>p.split('.').reduce((a,f)=>a?a[f]:undefined,c)??'');

export const dir = async (src) => (await readdir(src, { withFileTypes: true })) .filter((dirent) => dirent.isDirectory()) .filter((dirent) => !dirent.name.startsWith('_')) .map(({ name }) => path.join(src, name));
export const pathExists = async (location) => await access(location);
export const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf-8'));

export const opt = (defaults, args = argv) => ({ ...defaults, ...Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.substring(2).split('='))) });
export const chunk = (arr, chunkSize) => Array.from({ length: Math.ceil(arr.length / chunkSize) }, (_, i) => arr.slice(i * chunkSize, i * chunkSize + chunkSize));
export const isOutdated = async (src, dest) => (await stat(src)).mtime.getTime() > (await stat(dest)).mtime.getTime();
export const ms = (ms) => TIME_UNITS.reduce((str, [name, n]) => { const val = Math.floor(ms / n); ms %= n; return val ? `${str}${str ? ', ' : ''}${val} ${name}${val > 1 ? 's' : ''}` : str; }, '') || `${ms} ms`;

// strings
export const camelToKebab = s => s.replace(/[A-Z]/g, m => '-' + m.toLowerCase()).replace(/^-/,'');

// image processing
export const fitToKBounds = (w, h, K=1) => (w>1024*K||h>1024*K) ? (w>h ? [1024*K, parseInt(1024*K/(w/h))] : [parseInt(1024*K*(w/h)), 1024*K]) : [w,h]; // resize image to fit 1K

// Discover all posts in source database
export const discoverPosts = async (dbPath) => {
  const posts = [];
  const categories = await dir(dbPath);

  for (const category of categories) {
    const chapters = await dir(category);

    for (const chapter of chapters) {
      const postDirs = await dir(chapter);

      for (const postDir of postDirs) {
        const optionsPath = path.join(postDir, 'options.json');
        const options = await readJson(optionsPath);

        posts.push({
          path: postDir,
          category: path.basename(category),
          chapter: path.basename(chapter),
          postId: path.basename(postDir),
          ...options
        });
      }
    }
  }

  return posts.sort((a, b) => new Date(b.cdate) - new Date(a.cdate));
};
