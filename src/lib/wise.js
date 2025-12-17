import { DatabaseSync } from 'node:sqlite';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Initialize database
let db;
function getDb() {
  if (!db) {
    const dbPath = join(process.cwd(), '.temp', '.wise.sqlite');
    db = new DatabaseSync(dbPath);

    // Create manifest table
    db.exec(`
      CREATE TABLE IF NOT EXISTS manifest (
        path TEXT PRIMARY KEY,
        size INTEGER NOT NULL,
        mtime INTEGER NOT NULL,
        hash TEXT,
        last_checked INTEGER NOT NULL
      )
    `);

    // Create index for faster queries
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_mtime ON manifest(mtime)
    `);
  }
  return db;
}

/**
 * Compute hash of file content
 */
async function computeHash(filePath, algorithm = 'sha256') {
  const content = await fs.readFile(filePath);
  return createHash(algorithm).update(content).digest('hex');
}

/**
 * Get or update manifest entry for a file
 */
async function getManifestEntry(filePath, options = {}) {
  const db = getDb();
  const now = Date.now();

  try {
    const stats = await fs.stat(filePath);
    const mtimeMs = Math.floor(stats.mtimeMs);
    const size = stats.size;

    // Check if entry exists in manifest
    const existing = db.prepare(
      'SELECT * FROM manifest WHERE path = ?'
    ).get(filePath);

    let hash = null;
    let needsUpdate = false;

    if (existing) {
      // Check if file changed
      if (existing.mtime !== mtimeMs || existing.size !== size) {
        needsUpdate = true;
        if (options.hash) {
          hash = await computeHash(filePath);
        }
      } else {
        hash = existing.hash;
      }
    } else {
      // New file
      needsUpdate = true;
      if (options.hash) {
        hash = await computeHash(filePath);
      }
    }

    if (needsUpdate) {
      db.prepare(`
        INSERT OR REPLACE INTO manifest (path, size, mtime, hash, last_checked)
        VALUES (?, ?, ?, ?, ?)
      `).run(filePath, size, mtimeMs, hash, now);
    } else {
      // Update last_checked
      db.prepare(
        'UPDATE manifest SET last_checked = ? WHERE path = ?'
      ).run(now, filePath);
    }

    return {
      path: filePath,
      size,
      mtime: mtimeMs,
      mtimeDate: new Date(mtimeMs),
      hash,
      exists: true,
      lastChecked: now
    };

  } catch (err) {
    if (err.code === 'ENOENT') {
      // File doesn't exist, remove from manifest if present
      db.prepare('DELETE FROM manifest WHERE path = ?').run(filePath);
      return {
        path: filePath,
        exists: false
      };
    }
    throw err;
  }
}

/**
 * Enhanced stat with change detection
 * Returns rich information about file and its changes
 */
export async function stat(filePath, options = {}) {
  const db = getDb();

  // Get previous state before updating
  const previous = db.prepare(
    'SELECT size, mtime, hash FROM manifest WHERE path = ?'
  ).get(filePath);

  // Get current entry (this will update manifest)
  const entry = await getManifestEntry(filePath, options);

  if (!entry.exists) {
    throw new Error(`ENOENT: no such file or directory, stat '${filePath}'`);
  }

  // Detect changes compared to previous state
  const changed = previous && (
    previous.mtime !== entry.mtime ||
    previous.size !== entry.size
  );

  const sizeChanged = previous && previous.size !== entry.size;
  const contentChanged = options.hash && previous && previous.hash &&
                         previous.hash !== entry.hash;

  return {
    path: entry.path,
    size: entry.size,
    mtime: entry.mtime,
    mtimeDate: entry.mtimeDate,
    hash: entry.hash,
    exists: true,
    changed: changed || false,
    sizeChanged: sizeChanged || false,
    contentChanged: contentChanged || false,
    previousSize: previous?.size,
    previousMtime: previous?.mtime
  };
}

/**
 * Check if target has expired relative to source files
 * Returns true if target needs regeneration
 */
export async function notExpired(...a) {
  return !(await hasExpired(...a));
}
export async function hasExpired(target, sources, options = {}) {
  // Normalize sources to array
  if (!Array.isArray(sources)) {
    sources = [sources];
  }

  try {
    const targetEntry = await getManifestEntry(target, options);

    if (!targetEntry.exists) {
      return true; // Target doesn't exist, needs generation
    }

    // Check each source
    for (const source of sources) {
      const sourceEntry = await getManifestEntry(source, options);

      if (!sourceEntry.exists) {
        continue; // Source doesn't exist, skip
      }

      // Compare mtime
      if (sourceEntry.mtime > targetEntry.mtime) {
        return true; // Source is newer
      }

      // If hash comparison requested and both have hashes
      if (options.hash && sourceEntry.hash && targetEntry.hash) {
        if (sourceEntry.hash !== targetEntry.hash) {
          return true; // Content differs
        }
      }
    }

    return false; // Target is up to date

  } catch (err) {
    // If target doesn't exist, it has expired
    if (err.code === 'ENOENT') {
      return true;
    }
    throw err;
  }
}

/**
 * Compare two files
 * Returns null if files are identical, otherwise returns difference info
 */
export async function diff(file1, file2, options = {}) {
  try {
    const entry1 = await getManifestEntry(file1, options);
    const entry2 = await getManifestEntry(file2, options);

    if (!entry1.exists || !entry2.exists) {
      return {
        different: true,
        reason: !entry1.exists ? 'file1-missing' : 'file2-missing'
      };
    }

    // Quick checks: size
    if (entry1.size !== entry2.size) {
      return {
        different: true,
        reason: 'size',
        file1: { size: entry1.size, mtime: entry1.mtime },
        file2: { size: entry2.size, mtime: entry2.mtime }
      };
    }

    // If hash comparison requested, prioritize it
    if (options.hash) {
      const hash1 = entry1.hash || await computeHash(file1);
      const hash2 = entry2.hash || await computeHash(file2);

      if (hash1 === hash2) {
        // Content is identical, don't report mtime differences
        return null;
      } else {
        return {
          different: true,
          reason: 'content',
          file1: { size: entry1.size, mtime: entry1.mtime, hash: hash1 },
          file2: { size: entry2.size, mtime: entry2.mtime, hash: hash2 }
        };
      }
    }

    // Without hash, check mtime
    if (entry1.mtime !== entry2.mtime) {
      return {
        different: true,
        reason: 'mtime',
        file1: { size: entry1.size, mtime: entry1.mtime },
        file2: { size: entry2.size, mtime: entry2.mtime }
      };
    }

    // Files are identical
    return null;

  } catch (err) {
    if (err.code === 'ENOENT') {
      return {
        different: true,
        reason: 'missing',
        error: err.message
      };
    }
    throw err;
  }
}

/**
 * Smart copy that checks manifest before copying
 * Supports recursive copying
 */
export async function cp(src, dest, options = {}) {
  const {
    recursive = false,
    hash = false,
    force = false,
    preserveTimestamps = true,
    filter = null // Optional filter function (path) => boolean
  } = options;

  const srcStats = await fs.stat(src);

  if (srcStats.isDirectory()) {
    if (!recursive) {
      throw new Error(`EISDIR: illegal operation on a directory, cp '${src}' -> '${dest}'`);
    }

    // Recursive directory copy
    return await copyDirectory(src, dest, { hash, force, preserveTimestamps, filter });

  } else {
    // Single file copy
    return await copyFile(src, dest, { hash, force, preserveTimestamps });
  }
}

/**
 * Copy a single file with manifest checking
 */
async function copyFile(src, dest, options = {}) {
  const { hash = false, force = false, preserveTimestamps = true } = options;

  // Get source info
  const srcEntry = await getManifestEntry(src, { hash });

  if (!srcEntry.exists) {
    throw new Error(`ENOENT: no such file or directory, cp '${src}'`);
  }

  // Check if destination needs update
  let needsCopy = force;

  if (!needsCopy) {
    try {
      const destEntry = await getManifestEntry(dest, { hash });

      if (!destEntry.exists) {
        needsCopy = true;
      } else {
        // Compare size and mtime
        if (srcEntry.size !== destEntry.size || srcEntry.mtime > destEntry.mtime) {
          needsCopy = true;
        } else if (hash && srcEntry.hash && destEntry.hash) {
          // Hash comparison if available
          if (srcEntry.hash !== destEntry.hash) {
            needsCopy = true;
          }
        }
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        needsCopy = true;
      } else {
        throw err;
      }
    }
  }

  if (needsCopy) {
    // Ensure destination directory exists
    await fs.mkdir(dirname(dest), { recursive: true });

    // Copy file
    await fs.copyFile(src, dest);

    // Preserve timestamps if requested
    if (preserveTimestamps) {
      const srcStats = await fs.stat(src);
      await fs.utimes(dest, srcStats.atime, srcStats.mtime);
    }

    // Update manifest for destination
    await getManifestEntry(dest, { hash });

    return { copied: true, src, dest };
  }

  return { copied: false, src, dest, reason: 'up-to-date' };
}

/**
 * Recursively copy directory
 */
async function copyDirectory(src, dest, options = {}) {
  const { hash = false, force = false, preserveTimestamps = true, filter = null } = options;

  // Ensure destination directory exists
  await fs.mkdir(dest, { recursive: true });

  // Read source directory
  const entries = await fs.readdir(src, { withFileTypes: true });

  const results = [];

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    // Apply filter if provided
    if (filter && !filter(srcPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      // Recursively copy subdirectory
      const subResults = await copyDirectory(srcPath, destPath, options);
      results.push(...subResults);
    } else if (entry.isFile()) {
      // Copy file
      const result = await copyFile(srcPath, destPath, { hash, force, preserveTimestamps });
      results.push(result);
    }
  }

  return results;
}

/**
 * Utility: Get intersection of two arrays
 */
export function intersection(arr1, arr2) {
  const set2 = new Set(arr2);
  return arr1.filter(item => set2.has(item));
}

/**
 * Utility: Get difference of two arrays (items in arr1 but not in arr2)
 */
export function difference(arr1, arr2) {
  const set2 = new Set(arr2);
  return arr1.filter(item => !set2.has(item));
}

/**
 * Clean up old manifest entries (optional maintenance)
 */
export function cleanManifest(olderThanDays = 30) {
  const db = getDb();
  const threshold = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);

  const result = db.prepare(
    'DELETE FROM manifest WHERE last_checked < ?'
  ).run(threshold);

  return { deleted: result.changes };
}

/**
 * Get manifest statistics
 */
export function getManifestStats() {
  const db = getDb();

  const total = db.prepare('SELECT COUNT(*) as count FROM manifest').get();
  const withHash = db.prepare('SELECT COUNT(*) as count FROM manifest WHERE hash IS NOT NULL').get();
  const totalSize = db.prepare('SELECT SUM(size) as total FROM manifest').get();

  return {
    totalEntries: total.count,
    entriesWithHash: withHash.count,
    totalSize: totalSize.total || 0
  };
}

// Export database for advanced use cases
export function getDatabase() {
  return getDb();
}
