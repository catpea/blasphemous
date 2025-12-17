#!/usr/bin/env node

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { opt, html, md } from '../lib/util.js';
import { notExpired } from '../lib/wise.js';

if (import.meta.url === `file://${process.argv[1]}`){
  const contextObject = JSON.parse((await readFile(process.argv[3], { encoding: 'utf8' })));
  await postpages( process.argv[2], process.argv[3], process.argv[4], contextObject); // use command line arguments
}

export default async function postpages( contentPath, contextPath, productPath, contextObject) {

  if (!existsSync(contentPath)) throw new Error('htmlize requires that content points to a markdown file');
  if (!existsSync(contextPath)) throw new Error('htmlize requires that context points to a json file');

  // if ( await notExpired(productPath, [contentPath, contextPath]) ) return;

  const postMarkdown = await readFile(contentPath, { encoding: 'utf8' });
  const postContent = md(postMarkdown)
  const postPage = generatePostPage(postContent, contextObject);
  await writeFile(productPath, postPage);

}

function generatePostPage(content, context) {
  const hasCover = existsSync(join(context.path, 'cover.jpg'));
  const hasAudio = existsSync(join(context.path, 'audio.mp3'));

  return html`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${context.title}</title>
      <style>
        :root {
          color-scheme: light dark;
        }
      </style>
    </head>
    <body>
      <article>
        <h1>${context.title}</h1>
        ${ context.description ? `<p>${context.description}</p>` : '' }
        <time datetime="${context.cdate}">${new Date(context.cdate).toLocaleDateString()}</time>
        ${hasCover ? `<img src="cover.jpg" alt="Cover Image">` : ''}
        ${hasAudio ? `<audio controls src="audio.mp3"></audio>` : ''}
        <hr>
        ${content}
      </article>
    </body>
    </html>
  `;
}
