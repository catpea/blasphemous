import { join, basename } from 'path';
import { writeFile, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { discoverPosts } from '../lib/util.js';

export default async function homepages({ src, dest, recentCount = 12, featureTags = ['app', 'music', 'fancy'], ...options }) {
  const dbPath = join(src, 'db');
  const posts = await discoverPosts(dbPath);
  const wwwroot = join(dest, 'wwwroot');

  await mkdir(wwwroot, { recursive: true });

  const publishedPosts = posts.filter(p => !p.draft);

  // Find featured posts (posts with special tags)
  const featured = {};
  for (const tag of featureTags) {
    const taggedPosts = publishedPosts.filter(p => p.tags.includes(tag));
    if (taggedPosts.length > 0) {
      featured[tag] = taggedPosts[0]; // Most recent post with this tag
    }
  }

  // Get most recent posts
  const recentPosts = publishedPosts.slice(0, recentCount);

  const html = generateHomepageHtml(featured, recentPosts);
  await writeFile(join(wwwroot, 'index.html'), html);
}

function generateHomepageHtml(featured, recentPosts) {
  const featuredSection = Object.entries(featured).map(([tag, post]) => `
    <section class="featured-${tag}">
      <h3>${tag}</h3>
      <article>
        <h4><a href="permalink/${post.guid}/">${post.title}</a></h4>
        <time datetime="${post.cdate}">${new Date(post.cdate).toLocaleDateString()}</time>
        ${hasAppFile(post) ? '<span class="badge">Contains App</span>' : ''}
        ${hasAudio(post) ? '<span class="badge">Has Audio</span>' : ''}
      </article>
    </section>
  `).join('\n');

  const recentSection = recentPosts.map(post => `
    <article>
      <h3><a href="permalink/${post.guid}/">${post.title}</a></h3>
      <time datetime="${post.cdate}">${new Date(post.cdate).toLocaleDateString()}</time>
      <div class="tags">${post.tags.join(', ')}</div>
    </article>
  `).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Home</title>
</head>
<body>
  <header>
    <h1>Welcome</h1>
  </header>

  ${featuredSection ? `<section class="featured">${featuredSection}</section>` : ''}

  <section class="recent">
    <h2>Recent Posts</h2>
    ${recentSection}
  </section>

  <nav>
    <a href="page-001.html">All Posts</a>
  </nav>
</body>
</html>`;
}

function hasAppFile(post) {
  const filesPath = join(post.path, 'files');
  if (!existsSync(filesPath)) return false;
  // Check if there are any .html files in the files directory
  return existsSync(join(filesPath, 'app-example.html'));
}

function hasAudio(post) {
  return existsSync(join(post.path, 'audio.mp3'));
}
