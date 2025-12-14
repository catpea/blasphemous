import { opt } from './lib.js';

// define options (including program configuration) in object format,
const options = opt({
  maxThreads: cpus().length,
  pp: 24,
  src: 'samples/database',
  dest: 'dist',
  upload: 'samples/targets.json',
});

// use root await
