import { join } from 'path';
import { cp, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

export default async function mergebase({ src, dest, ...options }) {
  const wwwroot = join(dest, 'wwwroot');
  await mkdir(wwwroot, { recursive: true });

  // Global static files (merged to ALL destinations)
  const globalStatic = join(dest, '../static');
  if (existsSync(globalStatic)) {
    await cp(globalStatic, wwwroot, { recursive: true, force: false });
  }

  // Destination-specific static files
  const destStatic = join(dest, 'static');
  if (existsSync(destStatic)) {
    await cp(destStatic, wwwroot, { recursive: true, force: true });
  }
}
