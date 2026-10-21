import * as nodeFs from 'node:fs';
import * as os from 'node:os';
import * as nodePath from 'node:path';

/** Minimal synchronous filesystem adapter so the store is testable in memory. */
export interface Fs {
  exists(path: string): boolean;
  isDir(path: string): boolean;
  readdir(path: string): string[];
  readFile(path: string): string;
  writeFile(path: string, text: string): void;
  mkdir(path: string): void;
  unlink(path: string): void;
  rename(from: string, to: string): void;
  /** Remove an empty directory. */
  rmdir(path: string): void;
  /** Create a new, uniquely named directory for temporary files and return its path. */
  mkdtemp(prefix: string): string;
}

export const realFs: Fs = {
  exists: (p) => nodeFs.existsSync(p),
  isDir: (p) => nodeFs.existsSync(p) && nodeFs.statSync(p).isDirectory(),
  readdir: (p) => nodeFs.readdirSync(p),
  readFile: (p) => nodeFs.readFileSync(p, 'utf8'),
  writeFile: (p, text) => nodeFs.writeFileSync(p, text, 'utf8'),
  mkdir: (p) => nodeFs.mkdirSync(p, { recursive: true }),
  unlink: (p) => nodeFs.unlinkSync(p),
  rename: (from, to) => nodeFs.renameSync(from, to),
  rmdir: (p) => nodeFs.rmdirSync(p),
  mkdtemp: (prefix) => nodeFs.mkdtempSync(nodePath.join(os.tmpdir(), prefix)),
};

export class MemoryFs implements Fs {
  readonly files = new Map<string, string>();
  readonly dirs = new Set<string>(['/']);

  constructor(init: Record<string, string | null> = {}) {
    for (const [p, v] of Object.entries(init)) {
      if (v === null) this.mkdir(p);
      else {
        this.mkdir(nodePath.posix.dirname(norm(p)));
        this.writeFile(p, v);
      }
    }
  }

  exists(p: string): boolean {
    return this.files.has(norm(p)) || this.dirs.has(norm(p));
  }

  isDir(p: string): boolean {
    return this.dirs.has(norm(p));
  }

  readdir(p: string): string[] {
    const dir = norm(p);
    if (!this.dirs.has(dir)) throw new Error(`ENOENT: ${p}`);
    const prefix = dir === '/' ? '/' : dir + '/';
    const names = new Set<string>();
    for (const f of [...this.files.keys(), ...this.dirs]) {
      if (f !== dir && f.startsWith(prefix)) {
        const rest = f.slice(prefix.length);
        names.add(rest.split('/')[0]!);
      }
    }
    return [...names].sort();
  }

  readFile(p: string): string {
    const v = this.files.get(norm(p));
    if (v === undefined) throw new Error(`ENOENT: ${p}`);
    return v;
  }

  /** Like the real thing, needs the parent directory to exist. */
  writeFile(p: string, text: string): void {
    const n = norm(p);
    if (!this.dirs.has(nodePath.posix.dirname(n))) throw new Error(`ENOENT: ${p}`);
    this.files.set(n, text);
  }

  mkdir(p: string): void {
    let cur = norm(p);
    while (cur !== '/' && !this.dirs.has(cur)) {
      this.dirs.add(cur);
      cur = nodePath.posix.dirname(cur);
    }
  }

  unlink(p: string): void {
    if (!this.files.delete(norm(p))) throw new Error(`ENOENT: ${p}`);
  }

  rename(from: string, to: string): void {
    this.writeFile(to, this.readFile(from));
    this.unlink(from);
  }

  rmdir(p: string): void {
    const dir = norm(p);
    if (!this.dirs.has(dir)) throw new Error(`ENOENT: ${p}`);
    if (this.readdir(dir).length > 0) throw new Error(`ENOTEMPTY: ${p}`);
    this.dirs.delete(dir);
  }

  private temps = 0;

  mkdtemp(prefix: string): string {
    const dir = `/tmp/${prefix}${++this.temps}`;
    this.mkdir(dir);
    return dir;
  }
}

function norm(p: string): string {
  const n = nodePath.posix.normalize(p);
  return n.length > 1 && n.endsWith('/') ? n.slice(0, -1) : n;
}
