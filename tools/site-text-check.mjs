// The site's text check (apps/site/index.md, whose words): a change's
// commits since main, any that changes a file under
// apps/site/src/content/ whose author is not the operator's git identity
// is refused, named by its commit, its author and the files. A merge is
// judged by its own resolution, the files of the text that differ from
// every parent (git's combined diff), so one that only brings commits in
// names none and passes, each commit it brings judged by its own author.
// Main is the
// forge's, origin/main, where the checkout has it, else the local main;
// on main itself there is nothing since it, and the check passes. It
// reads a commit's author, which whoever makes the commit sets, so it
// guards against an accident, not an attacker.
//
//   node tools/site-text-check.mjs <repo root>

import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const TEXT = 'apps/site/src/content'
// The operator's git identity, by its email: the one author of the text.
export const OPERATOR = 'matan@shenhav.fyi'

const git = (root, args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' })

/** The revision a change's commits are counted from: the forge's main,
 * else the local one, or null where the checkout has neither. */
export function base(root) {
  for (const rev of ['origin/main', 'main']) {
    if (git(root, ['rev-parse', '--verify', '--quiet', `${rev}^{commit}`]).status === 0) return rev
  }
  return null
}

/** The commits of `base..HEAD` that change the text and are not the
 * operator's, `{ sha, author, files }`, oldest first; a merge's files are
 * those its resolution changes from every parent. */
export function refused(root, from) {
  const log = git(root, ['log', '--reverse', '--no-renames', '--cc', '--format=%x00%H%x09%an <%ae>', '--name-only', `${from}..HEAD`, '--', TEXT])
  if (log.status !== 0) throw new Error(`git log ${from}..HEAD: ${log.stderr.trim()}`)
  return log.stdout
    .split('\0')
    .filter((entry) => entry.trim())
    .map((entry) => {
      const [head, ...files] = entry.trim().split('\n')
      const [sha, author] = head.split('\t')
      return { sha, author, files: files.filter(Boolean) }
    })
    .filter(({ files }) => files.length)
    .filter(({ author }) => !author.toLowerCase().endsWith(`<${OPERATOR}>`))
}

/** The refusal a lane reads, saying what would fix it. */
export const reason = ({ sha, author, files }) =>
  `${sha.slice(0, 12)} by ${author} changes the site's text, which is the operator's (${OPERATOR}): ${files.join(', ')}. ` +
  'Drop the commit\'s change to the text, or draft it in apps/site/src/drafts/ and say in your entry\'s Flag what the text needs ' +
  '(AGENTS.md; apps/site/index.md, whose words).'

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = process.argv[2] ?? '.'
  const from = base(root)
  if (!from) {
    console.log('site text: no main to count the change from')
    process.exit(0)
  }
  const out = refused(root, from)
  for (const commit of out) console.error(reason(commit))
  if (out.length) {
    console.error(`site text: ${out.length} commit${out.length === 1 ? '' : 's'} since ${from} change the operator's text`)
    process.exit(1)
  }
  console.log(`site text: every commit since ${from} that changes it is the operator's`)
}
