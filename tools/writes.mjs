// Foreign writes: a feat's rows change only through its own code, and a
// graft writes only its own schema, changing a feat by calling that feat's
// published write from its handler. sql-check.mjs collects what a slice's
// SQL still writes or triggers on a table it does not own, net of what a
// later migration drops or replaces; `scanTs` does the same for the SQL a
// slice's TypeScript sends. `refuse` refuses every one of both: there
// are no exceptions.

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
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        out.push(node.text)
      } else if (ts.isTemplateExpression(node)) {
        let sql = node.head.text
        for (const [index, span] of node.templateSpans.entries()) {
          sql += `$${index + 1}${span.literal.text}`
        }
        out.push(sql)
      }
      ts.forEachChild(node, visit)
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

// Each foreign write or trigger in the TypeScript of a slice's package:
// `own` is its schema, and only `cella.*` beside it, which the notary
// guards, is not foreign.
export async function scanTs(repo, dir, owner, own) {
  await pg.loadModule?.()
  const out = []
  for (const file of sources(join(repo, dir, 'src'))) {
    for (const sql of literals(readFileSync(file, 'utf8'), file)) {
      let tree
      try {
        tree = pg.parseSync(sql)
      } catch {
        // Prose and fragments assembled at run time are not SQL statements.
        continue
      }
      for (const { relation, verb } of targets(tree)) {
        const schema = relation?.schemaname
        if (schema && schema !== own && schema !== 'cella') {
          const at = relative(repo, file)
          out.push({ owner, what: `${relative(join(repo, dir), file)} ${verb} ${schema}.${relation.relname}`, path: at })
        }
      }
    }
  }
  return out
}

// Every foreign write found, refused.
export function refuse(found) {
  return found.map((f) => `${f.path}: ${f.owner} ${f.what}, a table it does not own: a slice writes only its own schema, and changes a feat only by calling that feat's published write`)
}
