#!/usr/bin/env node
/**
 * Cross-platform replacements for the POSIX file commands used in package.json
 * scripts. pnpm runs scripts through cmd.exe on Windows, where `rm -rf`,
 * `mkdir -p`, `cp -R`, and `chmod` do not exist.
 *
 *   node scripts/fsx.mjs rm <path...>                 (rm -rf)
 *   node scripts/fsx.mjs mkdir <dir...>               (mkdir -p)
 *   node scripts/fsx.mjs cp <src...> <dest>           (cp -R; globs and `dir/.` supported)
 *   node scripts/fsx.mjs chmod <mode> <file...>       (no-op on Windows)
 */
import fs from "node:fs";
import path from "node:path";

const [command, ...args] = process.argv.slice(2);

function fail(message) {
  console.error(`fsx: ${message}`);
  process.exit(1);
}

function expand(pattern) {
  if (!/[*?[\]{}]/.test(pattern)) return [pattern];
  const matches = fs.globSync(pattern);
  if (matches.length === 0) fail(`no matches for ${pattern}`);
  return matches;
}

function copy(sources, dest) {
  const destIsDir =
    sources.length > 1 ||
    /[\\/]$/.test(dest) ||
    (fs.existsSync(dest) && fs.statSync(dest).isDirectory());
  for (const raw of sources.flatMap(expand)) {
    // `src/dir/.` copies the directory's contents rather than the directory itself.
    const contentsOnly = /[\\/]\.$/.test(raw);
    const src = contentsOnly ? raw.slice(0, -2) : raw;
    if (!fs.existsSync(src)) fail(`no such file or directory: ${raw}`);
    const target = contentsOnly || !destIsDir ? dest : path.join(dest, path.basename(src));
    if (destIsDir) fs.mkdirSync(dest, { recursive: true });
    fs.cpSync(src, target, { recursive: true, force: true });
  }
}

switch (command) {
  case "rm":
    for (const target of args) fs.rmSync(target, { recursive: true, force: true });
    break;
  case "mkdir":
    for (const dir of args) fs.mkdirSync(dir, { recursive: true });
    break;
  case "cp":
    if (args.length < 2) fail("cp requires at least one source and a destination");
    copy(args.slice(0, -1), args.at(-1));
    break;
  case "chmod": {
    if (args.length < 2) fail("chmod requires a mode and at least one file");
    if (process.platform === "win32") break;
    const [mode, ...files] = args;
    for (const file of files) {
      const current = fs.statSync(file).mode;
      const next = mode === "+x" ? current | 0o111 : Number.parseInt(mode, 8);
      if (Number.isNaN(next)) fail(`unsupported mode ${mode}`);
      fs.chmodSync(file, next);
    }
    break;
  }
  default:
    fail(`unknown command ${command ?? "(none)"}; expected rm, mkdir, cp, or chmod`);
}
