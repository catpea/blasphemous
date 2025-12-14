
// This is the main file

// make it readable

src = samples/sources/my-blog (there is also a company blog, but that would require running blasphemous for that path specifically that is a differet world) these blogs have category/chapter and then just post (privatly in my mind I call the category BOOK, maybe you can use that too, I want my blog to present multiple books, book on philosophy, on tenchonlogy on fitness.)
dest = samples/destinations

for(const destination of await destinations(dest)) {
  const opt = ... remember to read samples/destinations/.../options.json as those contain command data

  await mergebase({src, dest, ...opt.mergebase}) // static files / assets
  await permalink({src, dest, ...opt.permalink}) // create wwwroot/permalinks see samples/destinations/nekoweb-account-main/wwwroot/permalink/f5953c99-919a-4448-8c71-41386b8e8441 for example
  await pagerizer({src, dest, ...opt.pagerizer}) // create page-001.html ... WARNING no index.html that is a special feature
  await homepages({}) // generate index.html(s) higlilting most recent posts with specific tags such as app (contained app) music, has some extra mp3 in files

}
