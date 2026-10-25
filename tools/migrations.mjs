// Migrations are append-only, by stable ids. A migration's id is its app,
// the feat or graft whose SQL it is and its file name, `org:membership/
// 003-seats.sql`, or for an app's core `org:core/notary/001-cella.sql`: it
// holds while a feat moves in the tree, which changes its path. Each app's
// `migrations.lock` keeps every migration's id and hash: a locked file is
// never edited or removed, and a new one is locked by `cella migrate
// --lock` before it lands, so what a database has applied is what the tree
// still says.

export const LOCK = 'migrations.lock'

// The id of a migration by its path from the repository's root,
// `apps/<app>/…/sql/<file>`.
export const idOf = (path) => {
  const [, app, ...rest] = path.split('/')
  const file = rest.pop()
  const dirs = rest.at(-1) === 'sql' ? rest.slice(0, -1) : rest
  const at = dirs.findLastIndex((_, i) => i > 0 && (dirs[i - 1] === 'feats' || dirs[i - 1] === 'grafts'))
  const owner = at < 0 ? dirs : [dirs[at], ...dirs.slice(at + 1).filter((d, i) => i > 0 || d !== 'core')]
  return `${app}:${[...owner, file].join('/')}`
}

// A lock's lines, `<id> <sha256>`, as a map; `#` lines are comments.
export const parseLock = (text) =>
  new Map(
    text
      .split('\n')
      .filter((l) => l.trim() && !l.startsWith('#'))
      .map((l) => l.trim().split(/\s+/)),
  )

export const formatLock = (lock) =>
  [
    '# Every migration of this app, by id and SHA-256: append-only. `cella migrate',
    '# --lock` adds the new ones; a locked line is never edited or removed.',
    ...[...lock].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([id, hash]) => `${id} ${hash}`),
    '',
  ].join('\n')

// What breaks append-only, comparing a lock with the migrations on disk,
// each `{ id, path, hash }`: a locked one edited or gone, one not locked.
export const unlocked = (lock, files) => {
  const errors = []
  const seen = new Map()
  for (const f of files) {
    if (seen.has(f.id)) {
      errors.push(`${f.path} and ${seen.get(f.id)} share the id ${f.id}`)
    }
    seen.set(f.id, f.path)
    if (!lock.has(f.id)) {
      errors.push(`${f.path} is not locked: run \`cella migrate --lock\``)
    } else if (lock.get(f.id) !== f.hash) {
      errors.push(`${f.path} changed after it was locked; migrations are append-only, so add a new one instead`)
    }
  }
  for (const id of lock.keys()) {
    if (!seen.has(id)) {
      errors.push(`${id} is locked but gone; migrations are append-only`)
    }
  }
  return errors
}
