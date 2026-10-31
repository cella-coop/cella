// Migrations go by stable ids. A migration's id is its app, the feat or
// graft whose SQL it is and its file name, `org:membership/003-seats.sql`,
// or for an app's core `org:core/notary/001-cella.sql`: it holds while a
// feat moves in the tree, which changes its path. Until launch a migration
// is rewritten in place and every database rebuilt, so a database that
// applied a file since edited is refused, with the words to reset it.

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

// What a database applied that the tree has since edited, comparing what
// it recorded, id to hash, with the migrations on disk, each `{ id, path,
// hash }`: one refusal per file edited and, where `files` is the whole
// tree, per file gone or renamed, each saying how to rebuild.
const RESET = 'until launch a migration is rewritten in place and the database rebuilt: `cella db reset` (`--seed lanterne` to seed it), or drop the database and migrate it anew'
export const edited = (applied, files, { whole = true } = {}) => {
  const ids = new Set(files.map((f) => f.id))
  return [
    ...files.filter((f) => applied.has(f.id) && applied.get(f.id) !== f.hash).map((f) => `${f.path} (${f.id}) was edited after this database applied it; ${RESET}`),
    ...(whole ? [...applied.keys()].filter((id) => !ids.has(id)).map((id) => `${id} was applied to this database and is gone from the tree; ${RESET}`) : []),
  ]
}
