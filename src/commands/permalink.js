import { join, basename } from 'path';
import { mkdir, cp, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { discoverPosts } from './lib.js';

export default async function permalink({ src, dest, dir = 'permalink', ...options }) {
  const dbPath = join(src, 'db');
  const posts = await discoverPosts(dbPath);

  const permalinkRoot = join(dest, 'wwwroot', dir);
  await mkdir(permalinkRoot, { recursive: true });

  for (const post of posts) {
    if (post.draft) continue;

    const permalinkDir = join(permalinkRoot, post.guid);
    await mkdir(permalinkDir, { recursive: true });

    // Copy post content
    const textPath = join(post.path, 'text.md');
    if (existsSync(textPath)) {
      await cp(textPath, join(permalinkDir, 'text.md'));
    }

    // Copy cover image
    const coverPath = join(post.path, 'cover.jpg');
    if (existsSync(coverPath)) {
      await cp(coverPath, join(permalinkDir, 'cover.jpg'));
    }

    // Copy audio
    const audioPath = join(post.path, 'audio.mp3');
    if (existsSync(audioPath)) {
      await cp(audioPath, join(permalinkDir, 'audio.mp3'));
    }

    // Copy files directory
    const filesPath = join(post.path, 'files');
    if (existsSync(filesPath)) {
      await cp(filesPath, join(permalinkDir, 'files'), { recursive: true });
    }

    // Generate simple index.html
    const html = generatePostHtml(post);
    await writeFile(join(permalinkDir, 'index.html'), html);
  }

  return posts;
}

function generatePostHtml(post) {
  const hasCover = existsSync(join(post.path, 'cover.jpg'));
  const hasAudio = existsSync(join(post.path, 'audio.mp3'));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${post.title}</title>
</head>
<body>
  <article>
    <h1>${post.title}</h1>
    ${post.description ? `<p>${post.description}</p>` : ''}
    <time datetime="${post.cdate}">${new Date(post.cdate).toLocaleDateString()}</time>
    ${hasCover ? `<img src="cover.jpg" alt="Cover">` : ''}
    ${hasAudio ? `<audio controls src="audio.mp3"></audio>` : ''}
  </article>
</body>
</html>`;
}
