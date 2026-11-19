// The spelling check: cella's text writes "coop" and "coops", never the
// hyphenated spelling, in every tracked text file: its strings, its SQL's
// reasons and comments, its code's comments, its fixtures, docs and tests.
// A refusal names the file, the line and the word to write instead.
//
// It reads neither the site's text, apps/site/src/content/, which is the
// operator's (AGENTS.md, beyond the axioms), nor the Records kept as they
// were written: under _corpus/, the changes, the reviews, the turns and any
// file whose path holds a dated name, as 26-11-09-… or 2026-10-25/. A
// lockfile or a binary file is not text. A web address keeps its own
// spelling, as do the proper names in NAMES and any "co-operative", which
// the hyphenated word is not.
//
// The site and the diagrams are the site's check's, which the org's never
// reads (apps/org/rs/index.md, Gates), so each reads its own half: by
// default every path but apps/site/ and packages/diagrams/, with --site
// those alone.
//
//   node tools/spelling.mjs [--site] <repo root>

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// Spelled in two parts, so this file holds no word it refuses.
const WORD = new RegExp('\\bco' + '-ops?\\b', 'gi')
const URL = /\bhttps?:\/\/\S+/g

// Proper names that keep their own hyphen, written as their bodies write
// them.
export const NAMES = ['Co' + '-op Group', 'Co' + '-op Bank', 'Co' + '-op Party']

const HISTORY = ['_corpus/change/', '_corpus/review/', '_corpus/turn/']
const DATED = /(^|\/)\d{2}(\d{2})?-\d{2}-\d{2}/
const LOCKS = ['Cargo.lock', 'pnpm-lock.yaml', 'flake.lock']
const SITE = ['apps/site/', 'packages/diagrams/']

/** Whether the check reads a path, by where it sits: the org's half, or
 * with `site` the site's. */
export function read(path, site = false) {
  if (SITE.some((dir) => path.startsWith(dir)) !== site) {
    return false
  }
  if (path.startsWith('apps/site/src/content/')) {
    return false
  }
  if (path.startsWith('_corpus/') && (HISTORY.some((dir) => path.startsWith(dir)) || DATED.test(path.slice('_corpus/'.length)))) {
    return false
  }
  return !LOCKS.some((lock) => path === lock || path.endsWith(`/${lock}`))
}

/** The word to write for a refused one, its case kept. */
export const fix = (word) => word.replace('-', '')

/** Each refused word of a text, `{ line, word }`, in order. */
export function refused(text) {
  const out = []
  text.split('\n').forEach((raw, i) => {
    let line = raw.replace(URL, '')
    for (const name of NAMES) {
      line = line.replaceAll(name, '')
    }
    for (const [word] of line.matchAll(WORD)) {
      out.push({ line: i + 1, word })
    }
  })
  return out
}

/** Every refusal in a checkout's tracked text, `{ path, line, word }`, in
 * the org's half or the site's. */
export function check(root, site = false) {
  const ls = spawnSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 1 << 28 })
  if (ls.status !== 0) {
    throw new Error(`git ls-files: ${ls.stderr.trim()}`)
  }
  const out = []
  for (const path of ls.stdout.split('\0').filter(Boolean).filter((path) => read(path, site))) {
    let bytes
    try {
      bytes = readFileSync(join(root, path))
    } catch {
      // Tracked but gone from the worktree: a deletion not yet committed.
      continue
    }
    if (bytes.subarray(0, 8000).includes(0)) {
      continue
    }
    for (const hit of refused(bytes.toString('utf8'))) {
      out.push({ path, ...hit })
    }
  }
  return out
}

/** The refusal a lane reads, saying what would fix it. */
export const reason = ({ path, line, word }) =>
  `${path}:${line}: "${word}" is spelled "${fix(word)}" in cella's text (AGENTS.md); write "${fix(word)}", ` +
  'or, for a proper name that keeps its hyphen, add it to NAMES in tools/spelling.mjs'

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2)
  const site = args.includes('--site')
  const root = args.find((arg) => arg !== '--site') ?? '.'
  const out = check(root, site)
  for (const hit of out) {
    console.error(reason(hit))
  }
  if (out.length) {
    const files = new Set(out.map((hit) => hit.path)).size
    console.error(`spelling: ${out.length} word${out.length === 1 ? '' : 's'} in ${files} file${files === 1 ? '' : 's'} spelled with a hyphen`)
    process.exit(1)
  }
  console.log(`spelling: every tracked text file of the ${site ? 'site' : 'org'} writes coop`)
}
