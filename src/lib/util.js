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
export function escapeHtml(str) { return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]); }

// Discover all posts in source database
export const discoverPosts = async (dbPath) => {
  const posts = [];
  const categories = await dir(dbPath);

  for (const category of categories) {
    const chapters = await dir(category);

    for (const chapter of chapters) {
      const postDirs = await dir(chapter);

      for (const postDir of postDirs) {
        const optionsPath = path.join(postDir, 'post.json');
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

// Minimalist HTML tagged template `html`
// - Trims leading/trailing blank lines
// - Removes common indentation from all non-empty lines (dedent)
// - Preserves intended indentation for multiline interpolations
// - Trims trailing spaces on each line and collapses excessive blank lines
//
// Inspired by Perl/PHP heredoc ideas (dedenting, removing a common margin)
// while avoiding any heavy HTML parsing — purely line-based and safe for most templating uses.

export function html(strings, ...values) {
  // Interleave strings and values, preserving/aligning indentation for multiline values.
  const parts = [];
  for (let i = 0; i < strings.length; i++) {
    const before = strings[i];
    parts.push(before);

    if (i < values.length) {
      let v = values[i];
      if (v == null) v = '';
      else v = String(v);

      // If the preceding literal ends with an indentation (last line), use it to indent multiline values.
      const lastLineMatch = before.match(/(^|[\r\n])([ \t]*)$/);
      const indent = lastLineMatch ? lastLineMatch[2] : '';

      if (v.indexOf('\n') !== -1) {
        // Normalize newlines, then prefix each newline in the value with the indent
        v = v.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\n' + indent);
      }
      parts.push(v);
    }
  }

  let combined = parts.join('');

  // Normalize newlines
  combined = combined.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split into lines
  const lines = combined.split('\n');

  // Remove leading blank lines
  while (lines.length && lines[0].trim() === '') lines.shift();

  // Remove trailing blank lines
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();

  // If nothing left, return empty string
  if (!lines.length) return '';

  // Compute minimum indentation (in characters) among non-empty lines
  const indents = lines
    .filter((l) => l.trim() !== '')
    .map((l) => (l.match(/^[ \t]*/) || [''])[0].length);

  const minIndent = indents.length ? Math.min(...indents) : 0;

  // Remove minIndent whitespace chars from the start of each line, trim trailing spaces
  const dedented = lines.map((l) =>
    l.replace(new RegExp('^[ \\t]{0,' + minIndent + '}'), '').replace(/[ \t]+$/u, '')
  );

  // Collapse 3+ consecutive newlines into 2 newlines (avoid excessive vertical whitespace)
  const result = dedented.join('\n').replace(/\n{3,}/g, '\n\n');

  return result;
}

export function md(markdown="") {
  const refs = {};
  let html = markdown;

  // Phase 1: Extract reference definitions [id]: url "title"
  html = html.replace(
    /^\[([^\]]+)\]:\s*(\S+)(?:\s+["'(]([^"')]+)["')])?\s*$/gm,
    (_, id, url, title) => (refs[id.toLowerCase()] = { url, title }, '')
  );

  const patterns = [
    // Horizontal rules (before lists to avoid conflicts)
    { p: /^(\*[ ]*){3,}$/gm, r: '<hr>' },
    { p: /^(-[ ]*){3,}$/gm, r: '<hr>' },

    // Headers
    { p: /^(#{1,6})\s+(.+)$/gm, r: (_, h, t) => `<h${h.length}>${t}</h${h.length}>` },

    // Blockquotes
    { p: /^(?:>[ ]?.*\n?)+/gm, r: m => `<blockquote>${m.replace(/^>[ ]?/gm, '').trim()}</blockquote>` },

    // Unordered lists
    { p: /^(?:[*+-][ ]+.+\n?)+/gm, r: m =>
      `<ul>${m.trim().split('\n').map(l => `<li>${l.replace(/^[*+-]\s+/, '')}</li>`).join('')}</ul>` },

    // Ordered lists
    { p: /^(?:\d+\.[ ]+.+\n?)+/gm, r: m =>
      `<ol>${m.trim().split('\n').map(l => `<li>${l.replace(/^\d+\.\s+/, '')}</li>`).join('')}</ol>` },

    // Images inline: ![alt](url) or ![alt](url "title")
    { p: /!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]*)")?\)/g,
      r: (_, a, u, t) => `<img src="${u}" alt="${a}"${t ? ` title="${t}"` : ''}>` },

    // Images reference: ![alt][id]
    { p: /!\[([^\]]*)\]\[([^\]]+)\]/g, r(m, a, id) {
      const ref = refs[id.toLowerCase()];
      return ref ? `<img src="${ref.url}" alt="${a}"${ref.title ? ` title="${ref.title}"` : ''}>` : m;
    }},

    // Links inline: [text](url) or [text](url "title")
    { p: /\[([^\]]+)\]\((\S+?)(?:\s+"([^"]*)")?\)/g,
      r: (_, t, u, title) => `<a href="${u}"${title ? ` title="${title}"` : ''}>${t}</a>` },

    // Links reference: [text][id] or [text][]
    { p: /\[([^\]]+)\]\[([^\]]*)\]/g, r(m, t, id) {
      const ref = refs[(id || t).toLowerCase()];
      return ref ? `<a href="${ref.url}"${ref.title ? ` title="${ref.title}"` : ''}>${t}</a>` : m;
    }},

    // Links shortcut: [foo] becomes link if foo is defined reference
    { p: /\[([^\]]+)\](?!\[|\()/g, r(m, t) {
      const ref = refs[t.toLowerCase()];
      return ref ? `<a href="${ref.url}"${ref.title ? ` title="${ref.title}"` : ''}>${t}</a>` : m;
    }},

    // Bold (before italic to avoid conflicts)
    { p: /\*\*(.+?)\*\*/g, r: '<strong>$1</strong>' },
    { p: /__(.+?)__/g, r: '<strong>$1</strong>' },

    // Italic
    { p: /\*(.+?)\*/g, r: '<em>$1</em>' },
    { p: /_(.+?)_/g, r: '<em>$1</em>' },
  ];

  for (const { p, r } of patterns) html = html.replace(p, r);

  return html.trim();
}
