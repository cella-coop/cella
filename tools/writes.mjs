// Foreign writes: a feat's rows change only through its own code, and a
// graft writes only its own schema, changing a feat by calling that feat's
// published write from its handler; a core library is held to the same,
// and only the notary writes the log. sql-check.mjs collects what a
// slice's or a core library's SQL still writes or triggers on a table it
// does not own, net of what a later migration drops or replaces; `scanTs`
// does the same for the SQL their TypeScript sends, and finds a call of
// the notary's write functions outside `write`. `refuse` refuses every
// one: there are no exceptions.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import * as pg from 'libpg-query'

// Visit statements and data-modifying CTEs. Only a qualified target can
// be checked without knowing the connection's search path.
function targets(tree) {
  const out = []
  const walk = (node) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(walk)
    for (const [kind, body] of Object.entries(node)) {
      if (['InsertStmt', 'UpdateStmt', 'DeleteStmt', 'MergeStmt'].includes(kind)) {
        out.push({ relation: body.relation, verb: 'writes' })
      } else if (kind === 'CopyStmt' && body.is_from && body.relation) {
        out.push({ relation: body.relation, verb: 'writes' })
      } else if (kind === 'TruncateStmt') {
        for (const item of body.relations ?? []) out.push({ relation: item.RangeVar, verb: 'writes' })
      } else if (kind === 'CreateTrigStmt') {
        out.push({ relation: body.relation, verb: 'triggers on' })
      }
      walk(body)
    }
  }
  walk(tree)
  return out
}

// TypeScript syntax determines which text is a literal, so a SQL-looking
// comment, regex or prose outside a literal is never read as a query.
function literals(text, file) {
  const out = []
  const collect = (source) => {
    const visit = (node) => {
      // Treat a + chain as a single SQL candidate. A variable in the
      // chain stands in as a parameter, just like a template span.
      let parameter = 0
      let literal = false
      const render = (part) => {
        if (ts.isBinaryExpression(part) && part.operatorToken.kind === ts.SyntaxKind.PlusToken) {
          return render(part.left) + render(part.right)
        }
        if (ts.isStringLiteral(part) || ts.isNoSubstitutionTemplateLiteral(part)) {
          literal = true
          return part.text
        }
        if (ts.isTemplateExpression(part)) {
          literal = true
          return part.head.text + part.templateSpans.map((span) => `$${++parameter}${span.literal.text}`).join('')
        }
        return ` $${++parameter} `
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const sql = render(node)
        if (literal) out.push(sql)
        else ts.forEachChild(node, visit)
      } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
        out.push(render(node))
      } else {
        ts.forEachChild(node, visit)
      }
    }
    visit(ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS))
  }
  if (file.endsWith('.svelte')) {
    for (const match of text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) collect(match[1])
  } else {
    collect(text)
  }
  return out
}

// When an interpolation replaces SQL syntax rather than a value, the
// parser cannot read the whole statement. Scan its tokens with Postgres's
// own lexer instead: comments, string values and quoted identifiers retain
// their SQL meanings. A verb must start a statement (or a CTE body), not
// merely occur in a sentence about a table.
function scannedTargets(sql) {
  if (!sql.trim()) return []
  let tokens
  try {
    tokens = pg.scanSync(sql).tokens
  } catch {
    // `$${n}` in TypeScript constructs a parameter marker; its
    // standalone `$` is not itself valid SQL for Postgres's scanner.
    try {
      tokens = pg.scanSync(sql.replace(/\$\$\d+/g, ' $1 ')).tokens
    } catch {
      // An isolated prose fragment (including an unmatched apostrophe)
      // has no complete statement for the SQL lexer to scan.
      return []
    }
  }
  const out = []
  const word = (i) => tokens[i]?.text?.toUpperCase()
  const identifier = (i) => {
    const token = tokens[i]
    if (!token || (token.tokenName !== 'IDENT' && ![1, 2, 3].includes(token.keywordKind))) return null
    return token.text.startsWith('"') ? token.text.slice(1, -1).replaceAll('""', '"') : token.text.toLowerCase()
  }
  const target = (i, verb = 'writes') => {
    const schema = identifier(i)
    const name = identifier(i + 2)
    if (schema && word(i + 1) === '.' && name) {
      out.push({ relation: { schemaname: schema, relname: name }, verb })
      return i + 3
    }
    return i
  }
  for (let i = 0; i < tokens.length; i++) {
    if (i && ![';', '('].includes(word(i - 1))) continue
    const verb = word(i)
    if (verb === 'UPDATE' || verb === 'DELETE') {
      let at = i + (verb === 'DELETE' ? 2 : 1)
      if (verb === 'DELETE' && word(i + 1) !== 'FROM') continue
      if (word(at) === 'ONLY') at++
      target(at)
    } else if (verb === 'INSERT' || verb === 'MERGE') {
      if (word(i + 1) === 'INTO') target(i + 2)
    } else if (verb === 'TRUNCATE') {
      let at = i + 1
      if (word(at) === 'TABLE') at++
      do {
        if (word(at) === 'ONLY') at++
        const next = target(at)
        if (next === at) break
        at = next
        if (word(at) === '*') at++
        if (word(at) !== ',') break
        at++
      } while (at < tokens.length)
    } else if (verb === 'COPY') {
      let at = i + 1
      if (word(at) === '(') continue // COPY (query) TO is not a write.
      const start = at
      // Check FROM after the optional column list, not inside it.
      at += identifier(at) && word(at + 1) === '.' && identifier(at + 2) ? 3 : 0
      if (word(at) === '(') {
        let depth = 0
        do {
          if (word(at) === '(') depth++
          if (word(at) === ')') depth--
          at++
        } while (depth && at < tokens.length)
      }
      if (word(at) === 'FROM') target(start)
    } else if (verb === 'CREATE') {
      let at = i + 1
      if (word(at) === 'OR' && word(at + 1) === 'REPLACE') at += 2
      if (word(at) === 'CONSTRAINT') at++
      if (word(at) !== 'TRIGGER') continue
      for (at++; at < tokens.length && word(at) !== ';'; at++) {
        if (word(at) === 'ON') {
          target(at + 1, 'triggers on')
          break
        }
      }
    }
  }
  return out
}

const sources = (dir) => {
  const out = []
  for (const name of existsSync(dir) ? readdirSync(dir) : []) {
    const path = join(dir, name)
    if (['_tests', '_e2e', 'node_modules'].includes(name)) {
      continue
    }
    if (statSync(path).isDirectory()) {
      out.push(...sources(path))
    } else if (/\.(ts|svelte)$/.test(name) && !/\.test\.ts$/.test(name)) {
      out.push(path)
    }
  }
  return out
}

// Each foreign write or trigger in the TypeScript of a slice's, a core
// library's or the shell's package, and each call of the notary's write
// functions: `own` is its schema, null for the shell's, which owns none.
// Only the notary writes `cella.*` (`notary`), and only `@cella/org-db`,
// whose `write` is the one path a handler writes by, calls `cella.begin`,
// `cella.submit` or `cella.follow` (`writer`).
export async function scanTs(repo, dir, owner, own, { notary = false, writer = false } = {}) {
  await pg.loadModule?.()
  const out = []
  for (const file of sources(join(repo, dir, 'src'))) {
    const at = relative(repo, file)
    const where = relative(join(repo, dir), file)
    for (const sql of literals(readFileSync(file, 'utf8'), file)) {
      let found
      let tree = null
      try {
        tree = pg.parseSync(sql)
        found = targets(tree)
      } catch {
        // Do not pass a literal merely because its SET, VALUES or column
        // list could not be represented as a parameter by the parser.
        found = scannedTargets(sql)
      }
      for (const { relation, verb } of found) {
        const schema = relation?.schemaname
        if (schema === 'cella' && !notary) {
          out.push({ owner, what: `${where} ${verb} cella.${relation.relname}`, path: at, rule: 'log' })
        } else if (schema && schema !== own && schema !== 'cella') {
          out.push({ owner, what: `${where} ${verb} ${schema}.${relation.relname}`, path: at, rule: own ? undefined : 'shell' })
        }
      }
      for (const fn of writer ? [] : calls(tree, sql)) {
        out.push({ owner, what: `${where} calls cella.${fn}`, path: at, rule: 'write' })
      }
    }
  }
  return out
}

// The notary's write functions: a write opens with `cella.begin`, settles
// with `cella.submit`, and an effect follows its cause by `cella.follow`.
const settling = new Set(['begin', 'submit', 'follow'])

// The notary's write functions a literal calls, from its parse tree, or
// its tokens where it does not parse whole.
function calls(tree, sql) {
  const out = new Set()
  if (tree) {
    const walk = (node) => {
      if (!node || typeof node !== 'object') return
      if (Array.isArray(node)) return node.forEach(walk)
      for (const [kind, body] of Object.entries(node)) {
        if (kind === 'FuncCall') {
          const [schema, name] = (body.funcname ?? []).map((n) => n.String?.sval)
          if (schema === 'cella' && settling.has(name)) out.add(name)
        }
        walk(body)
      }
    }
    walk(tree)
    return [...out]
  }
  let tokens
  try {
    tokens = pg.scanSync(sql.replace(/\$\$\d+/g, ' $1 ')).tokens
  } catch {
    return []
  }
  const word = (i) => tokens[i]?.text?.toLowerCase()
  for (let i = 0; i + 3 < tokens.length; i++) {
    if (word(i) === 'cella' && word(i + 1) === '.' && settling.has(word(i + 2)) && word(i + 3) === '(') out.add(word(i + 2))
  }
  return [...out]
}

// Every foreign write found, refused.
export function refuse(found) {
  return found.map((f) =>
    f.rule === 'log'
      ? `${f.path}: ${f.owner} ${f.what}, the notary's: only the notary writes cella.*, and a slice or a core library registers there from its migrations alone`
      : f.rule === 'write'
        ? `${f.path}: ${f.owner} ${f.what}, which only write in @cella/org-db calls: a handler writes through write`
        : f.rule === 'shell'
          ? `${f.path}: ${f.owner} ${f.what}: the shell owns no schema and writes no SQL; it changes a feat by calling that feat's published write`
          : `${f.path}: ${f.owner} ${f.what}, a table it does not own: a slice writes only its own schema, and changes a feat only by calling that feat's published write`)
}
