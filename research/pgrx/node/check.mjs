// Rule checker: parses LANGUAGE sql functions with libpg_query (Postgres's own parser) and
// refuses references outside the owner's schemas, the clock, randomness and unknown functions.
// Usage: node check.mjs <file.sql>...
import { readFileSync } from 'node:fs'
import { loadModule, parseSync } from 'libpg-query'

// a feat sees its own schema; a graft also sees the feats it joins
const grafts = { decision_member: ['decision', 'member'], client_invoice: ['client', 'invoice'] }
const aggregates = new Set(['count', 'sum', 'min', 'max', 'avg', 'bool_and', 'bool_or', 'every'])
const operators = new Set(['=', '<>', '!=', '<', '>', '<=', '>=', '+', '-', '*', '/', '%', '->', '->>', '@>', '<@', '?', '||'])

await loadModule()

const walk = (node, visit) => {
  if (Array.isArray(node)) {
    node.forEach((n) => walk(n, visit))
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      visit(k, v)
      walk(v, visit)
    }
  }
}
const names = (list) => list.map((n) => n.String.sval)

function check(fn) {
  const [owner, name] = names(fn.funcname)
  const allowed = new Set([owner, 'cella', ...(grafts[owner] ?? [])])
  const refs = { schemas: new Set(), functions: new Set(), refused: [] }
  const ctes = new Set()
  const opt = (k) => fn.options.find((o) => o.DefElem.defname === k)?.DefElem.arg
  let body = fn.sql_body
  if (!body) {
    // a string body: parse it too
    body = parseSync(names(opt('as').List.items)[0]).stmts
  }
  if (!owner) {
    refs.refused.push('function is not schema-qualified')
  }
  if (opt('language')?.String.sval !== 'sql') {
    refs.refused.push('only LANGUAGE sql rules are composed')
  }
  walk(body, (k, v) => {
    if (k === 'CommonTableExpr') {
      ctes.add(v.ctename)
    }
  })
  walk(body, (k, v) => {
    if (k === 'RangeVar') {
      if (v.schemaname) {
        refs.schemas.add(v.schemaname)
        if (!allowed.has(v.schemaname)) {
          refs.refused.push(`reads ${v.schemaname}.${v.relname}: outside ${[...allowed].join(', ')}`)
        }
      } else if (!ctes.has(v.relname)) {
        refs.refused.push(`unqualified relation ${v.relname}`)
      }
    } else if (k === 'FuncCall') {
      const f = names(v.funcname)
      const full = f.join('.')
      refs.functions.add(full)
      if (f.length === 2) {
        refs.schemas.add(f[0])
        if (!allowed.has(f[0])) {
          refs.refused.push(`calls ${full}: outside ${[...allowed].join(', ')}`)
        }
      } else if (!aggregates.has(f[0])) {
        refs.refused.push(`calls ${full}(): not in the allow-list`)
      }
    } else if (k === 'SQLValueFunction') {
      refs.refused.push(`reads the clock or session (${v.op.replace('SVFOP_', '').toLowerCase()})`)
    } else if (k === 'A_Expr' && v.name) {
      const op = names(v.name)
      if (op.length === 2 && op[0] !== 'cella') {
        refs.refused.push(`operator ${op.join('.')}`)
      } else if (op.length === 1 && !operators.has(op[0])) {
        refs.refused.push(`operator ${op[0]} not in the allow-list`)
      }
    }
  })
  return { fn: `${owner}.${name}`, ...refs }
}

let failed = 0
for (const file of process.argv.slice(2)) {
  for (const { stmt } of parseSync(readFileSync(file, 'utf8')).stmts) {
    if (!stmt.CreateFunctionStmt) {
      continue
    }
    const r = check(stmt.CreateFunctionStmt)
    const ok = r.refused.length === 0
    failed += ok ? 0 : 1
    console.log(`${ok ? 'ok     ' : 'REFUSED'} ${r.fn}  schemas [${[...r.schemas].join(', ')}]  functions [${[...r.functions].join(', ')}]`)
    for (const why of new Set(r.refused)) {
      console.log(`          - ${why}`)
    }
  }
}
process.exit(failed ? 1 : 0)
