These are a special breed of commands, they can run on the command line, but also can be loaded as ESM modules.
see src/cmd/example-command.js for implementation details.

```js

import { opt } from './lib/util.js';

// define command defaults, revealing what is supported
const defaults = {
  src: 'text.md',
  dest: 'text.html',
};

// Handle executing as a command
// NOTE: Command Line Expect JSON path
if (import.meta.url === `file://${process.argv[1]}`){
 const options = {...defaults};
 await exampleCommand(opt(options)); // use command line arguments
}

// Supporting executing as a module
export default async function exampleCommand(options) {
  const { src, dest } = Object.assign({}, defaults, options);

  // perform operations

  // return result
}


```
