import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { discoverPosts, interpol, chunk } from './lib.js';

export default async function pagerizer({ src, dest, perpage = 12, filename = 'page-${nnn}.html', ...options }) {
  const dbPath = join(src, 'db');
  const posts = await discoverPosts(dbPath);

  const wwwroot = join(dest, 'wwwroot');
  await mkdir(wwwroot, { recursive: true });

  const publishedPosts = posts.filter(p => !p.draft);
  const pages = chunk(publishedPosts, perpage);

  // Clean filename (remove comments like "<-- CLAUSE ...")
  const cleanFilename = filename.split('<--')[0].trim();

  for (let i = 0; i < pages.length; i++) {
    const pageNum = String(i + 1).padStart(3, '0');
    const pageName = interpol(cleanFilename, { nnn: pageNum, n: i + 1 });
    const html = generatePageHtml(pages[i], i + 1, pages.length);

    await writeFile(join(wwwroot, pageName), html);
  }
}

function generatePageHtml(posts, currentPage, totalPages) {
  const postList = posts.map(post => `
    <article>
      <h2><a href="permalink/${post.guid}/">${post.title}</a></h2>
      <time datetime="${post.cdate}">${new Date(post.cdate).toLocaleDateString()}</time>
      ${post.description ? `<p>${post.description}</p>` : ''}
      <div class="tags">${post.tags.join(', ')}</div>
    </article>
  `).join('\n');

  const prevLink = currentPage > 1 ? `<a href="page-${String(currentPage - 1).padStart(3, '0')}.html">Previous</a>` : '';
  const nextLink = currentPage < totalPages ? `<a href="page-${String(currentPage + 1).padStart(3, '0')}.html">Next</a>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page ${currentPage}</title>
</head>
<body>
  <nav>
    ${prevLink}
    <span>Page ${currentPage} of ${totalPages}</span>
    ${nextLink}
  </nav>
  <main>
    ${postList}
  </main>
</body>
</html>`;
}
