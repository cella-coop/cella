// SQL boundaries: parses every sql/*.sql on the feat tree with libpg_query,
// Postgres's own parser, and refuses any reference the tree does not allow.
//
//   SQL in            may reference
//   a node's core     cella.*; the catalog
//   a feat            its own schema; those of the feats it nests in;
//                     cella.*; the catalog
//   a graft           its own schema; the schemas of the feats it joins and
//                     of the feats they nest in; the schemas of the grafts
//                     at or below its node that join a proper subset of its
//                     feats; cella.*; the catalog
//
// Beyond the references, a feat's or a graft's SQL:
//   - creates, alters, drops, indexes and grants only in its own schema;
//   - holds no foreign key out of its own schema;
//   - writes cella.* only to register, under its own name: its rules, on
//     ops of its own feat, of the feats it joins or of the lower-order
//     grafts it builds on (cella.rule); the power
//     each of its own ops needs (cella.power), which feat-check compares
//     with its ops.ts; and, a feat only, the keyring (cella.keyring);
//   - never sets search_path but on a function, to the catalog;
//   - never reads the clock or randomness, since rules read
//     cella.verdict_date(), and has no DO block, which this check cannot
//     see into.
// PL/pgSQL bodies are parsed statement by statement; LANGUAGE sql bodies,
// atomic or quoted, are parsed whole.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const catalog = new Set(['pg_catalog', 'pg_temp', 'information_schema'])
const clock = new Set([
  'now', 'clock_timestamp', 'statement_timestamp', 'transaction_timestamp', 'timeofday',
  'random', 'random_normal', 'setseed', 'gen_random_uuid', 'uuidv4', 'uuidv7',
])
const regtypes = new Set(['regclass', 'regproc', 'regprocedure', 'regtype', 'regnamespace', 'regoper', 'regoperator'])

const schemaOf = (name) => name.replaceAll('-', '_')
const strings = (list) => (list ?? []).map((n) => n.String?.sval).filter((s) => s !== undefined)

// Every sql/ directory on the tree and whose it is. A feat carries the
// feats it nests in, outermost first; a graft, the grafts at or below its
// node and, by feat, the feats each nests in.
export function owners(repo, apps) {
  const out = []
  const list = (dir) => (existsSync(join(repo, dir)) ? readdirSync(join(repo, dir)) : [])
  // An app's core SQL is the core's; a feat's core SQL is the feat's own.
  const visit = (node, feat, lineage, nests) => {
    const core = join(node, 'core')
    const owner = feat ? { kind: 'feat', node: dirname(dirname(node)), name: feat, lineage } : { kind: 'core', node }
    if (existsSync(join(repo, core, 'sql'))) {
      out.push({ dir: join(core, 'sql'), ...owner })
    }
    for (const lib of existsSync(join(repo, core)) ? readdirSync(join(repo, core)) : []) {
      if (existsSync(join(repo, core, lib, 'sql'))) {
        out.push({ dir: join(core, lib, 'sql'), ...owner })
      }
    }
    const inner = feat ? [...lineage, feat] : []
    for (const f of list(join(node, 'feats'))) {
      nests.set(f, inner)
      visit(join(node, 'feats', f), f, inner, nests)
    }
    const under = (n) => [...list(join(n, 'grafts')), ...list(join(n, 'feats')).flatMap((f) => under(join(n, 'feats', f)))]
    for (const g of list(join(node, 'grafts'))) {
      if (existsSync(join(repo, node, 'grafts', g, 'sql'))) {
        out.push({ dir: join(node, 'grafts', g, 'sql'), kind: 'graft', node, name: g, grafts: under(node), nests })
      }
    }
  }
  apps.forEach((app) => visit(app, null, [], new Map()))
  return out
}

// The schemas an owner's SQL may reference, and its own.
function scope(o) {
  if (o.kind === 'core') {
    return { own: null, allowed: new Set(['cella', ...catalog]), feats: [], ops: [] }
  }
  if (o.kind === 'feat') {
    return { own: o.name, allowed: new Set([o.name, ...o.lineage, 'cella', ...catalog]), feats: [o.name], ops: [o.name] }
  }
  const feats = o.name.split('-')
  const outer = feats.flatMap((f) => o.nests.get(f) ?? [])
  const lower = o.grafts.filter((g) => {
    const parts = g.split('-')
    return parts.length < feats.length && parts.every((p) => feats.includes(p))
  })
  return { own: schemaOf(o.name), allowed: new Set([schemaOf(o.name), ...feats, ...outer, ...lower.map(schemaOf), 'cella', ...catalog]), feats, ops: [o.name, ...feats, ...lower] }
}

const walk = (node, visit, key = null) => {
  if (Array.isArray(node)) {
    node.forEach((n) => walk(n, visit, key))
  } else if (node && typeof node === 'object') {
    visit(key, node)
    for (const [k, v] of Object.entries(node)) {
      walk(v, visit, k)
    }
  }
}

// One parsed tree's references and the statements that need more than a
// reference check.
function inspect(tree, o, s, known, fail, found) {
  const ref = (schema, what) => {
    if (schema && !s.allowed.has(schema)) {
      fail(`${what}: ${schema} is outside ${[...s.allowed].filter((x) => !catalog.has(x)).join(', ')}`)
    }
  }
  const owned = (schema, what) => {
    if (o.kind !== 'core' && schema !== s.own) {
      fail(`${what}: ${o.kind} ${o.name} creates and grants only in its own schema, ${s.own}`)
    }
  }
  const named = (rv) => (rv.schemaname ? `${rv.schemaname}.${rv.relname}` : rv.relname)
  walk(tree, (key, n) => {
    if (n.relname !== undefined) {
      ref(n.schemaname, `reads ${named(n)}`)
    }
    if (key === 'funcname' || key === 'objname') {
      return
    }
    for (const field of ['funcname', 'objname']) {
      const parts = strings(n[field])
      if (parts.length > 1) {
        ref(parts[0], `names ${parts.join('.')}`)
      }
    }
    if (n.names && n.typemod !== undefined) {
      const parts = strings(n.names)
      if (parts.length > 1) {
        ref(parts[0], `uses the type ${parts.join('.')}`)
      }
    }
    if (n.A_Expr?.name) {
      const parts = strings(n.A_Expr.name)
      if (parts.length > 1) {
        ref(parts[0], `uses the operator ${parts.join('.')}`)
      }
    }
    // A function, table or sequence named in a string: 'x.y(jsonb)'.
    const text = n.A_Const?.sval?.sval
    const m = text?.match(/^([a-z_][a-z0-9_]*)\.[a-z_][a-z0-9_]*(\(.*\))?$/)
    if (m && known.has(m[1])) {
      ref(m[1], `names ${text}`)
    }
    if (n.FuncCall && o.kind !== 'core') {
      const f = strings(n.FuncCall.funcname)
      if ((f.length === 1 || f[0] === 'pg_catalog') && clock.has(f.at(-1))) {
        fail(`calls ${f.join('.')}(): rules read cella.verdict_date(), never the clock or randomness`)
      }
    }
    if (n.SQLValueFunction && o.kind !== 'core') {
      fail(`reads ${n.SQLValueFunction.op.replace('SVFOP_', '').toLowerCase()}: rules read cella.verdict_date(), never the clock`)
    }
    if (n.TypeCast && regtypes.has(strings(n.TypeCast.typeName?.names).at(-1))) {
      const name = n.TypeCast.arg?.A_Const?.sval?.sval ?? ''
      const parts = name.split('(')[0].split('.')
      if (parts.length > 1) {
        ref(parts[0], `names ${name}`)
      }
    }
  })
  for (const { stmt } of tree.stmts ?? []) {
    const [type, body] = Object.entries(stmt)[0]
    statement(type, body, o, s, fail, owned, named, found)
  }
}

const registries = new Set(['rule', 'power', 'keyring', 'personal'])

// A column whose name and type suggest personal data: a person's name,
// contact details, address, bank details, birth, pay, notes or a
// receipt's text, held as text, JSON or an amount. Each must be declared,
// registered in `cella.personal` or commented `not personal: …`.
const suspect = /^(name|full_name|first_name|last_name|email|phone|mobile|iban|bic|address|street|city|postal_code|birth\w*|salary|gross|net|note|notes|receipt)$/
const typed = new Set(['text', 'varchar', 'jsonb', 'json', 'amount', 'numeric'])

// Each column a statement creates, by its schema, table, name and type.
function columns(rel, defs, path, found) {
  for (const d of defs ?? []) {
    const c = d.ColumnDef
    if (c) {
      found.columns.push({ key: `${rel.schemaname}.${rel.relname}.${c.colname}`, type: strings(c.typeName?.names).at(-1), path })
    }
  }
}

// The suspect columns declared neither personal nor not.
export function undeclared(found) {
  const declared = new Set([...found.personal, ...found.impersonal])
  return found.columns
    .filter((c) => suspect.test(c.key.split('.')[2]) && typed.has(c.type) && !declared.has(c.key))
    .map((c) => `${c.path}: ${c.key} may hold personal data: register it in cella.personal, or comment it 'not personal: why'`)
}

// The decision feat's register of the ops that cite a decision, whose
// rows mark an op as decided: the graft that counts a decision's roll
// attaches its rule to every op listed.
const cites = { schema: 'decision', table: 'cites' }

function citing(b, o, found) {
  const cols = (b.cols ?? []).map((c) => c.ResTarget.name)
  for (const row of b.selectStmt?.SelectStmt?.valuesLists ?? []) {
    const vals = Object.fromEntries(row.List.items.map((v, i) => [cols[i], v.A_Const?.sval?.sval]))
    if (vals.op) {
      found.cites.push({ op: vals.op, owner: o.name })
    }
  }
}

function statement(type, b, o, s, fail, owned, named, found) {
  switch (type) {
    case 'CreateSchemaStmt':
      owned(b.schemaname, `creates the schema ${b.schemaname}`)
      break
    case 'CreateStmt':
      owned(b.relation.schemaname, `creates ${named(b.relation)}`)
      if (o.kind !== 'core') {
        columns(b.relation, b.tableElts, found.at, found)
      }
      walk(b, (_, n) => {
        if (n.Constraint?.contype === 'CONSTR_FOREIGN' && n.Constraint.pktable?.schemaname !== b.relation.schemaname) {
          fail(`${named(b.relation)} holds a foreign key into ${named(n.Constraint.pktable)}: no foreign key crosses a feat`)
        }
      })
      break
    case 'CreateSeqStmt':
      owned(b.sequence.schemaname, `creates ${named(b.sequence)}`)
      break
    case 'ViewStmt':
      owned(b.view.schemaname, `creates ${named(b.view)}`)
      break
    case 'IndexStmt':
    case 'AlterTableStmt':
      owned(b.relation.schemaname, `${type === 'IndexStmt' ? 'indexes' : 'alters'} ${named(b.relation)}`)
      if (type === 'AlterTableStmt' && o.kind !== 'core') {
        const added = (b.cmds ?? []).map((c) => c.AlterTableCmd).filter((c) => c?.subtype === 'AT_AddColumn').map((c) => c.def)
        columns(b.relation, added, found.at, found)
      }
      break
    case 'CommentStmt':
      if (b.objtype === 'OBJECT_COLUMN') {
        const parts = strings(b.object?.List?.items)
        owned(parts[0], `comments on ${parts.join('.')}`)
        if (/^not personal: ./.test(b.comment ?? '')) {
          found.impersonal.push(parts.join('.'))
        }
      }
      break
    case 'CreateFunctionStmt': {
      const f = strings(b.funcname)
      owned(f.length > 1 ? f[0] : null, `creates ${f.join('.')}`)
      for (const o2 of b.options ?? []) {
        const set = o2.DefElem.defname === 'set' ? o2.DefElem.arg.VariableSetStmt : null
        if (set?.name === 'search_path') {
          for (const v of set.args ?? []) {
            if (!catalog.has(v.A_Const?.sval?.sval)) {
              fail(`${f.join('.')} sets search_path to ${v.A_Const?.sval?.sval}: only the catalog, and every name qualified`)
            }
          }
        }
      }
      break
    }
    case 'CompositeTypeStmt':
      owned(b.typevar.schemaname, `creates the type ${named(b.typevar)}`)
      break
    case 'CreateEnumStmt':
    case 'DefineStmt': {
      const parts = strings(b.typeName ?? b.defnames)
      owned(parts.length > 1 ? parts[0] : null, `creates ${parts.join('.')}`)
      break
    }
    case 'DropStmt':
      for (const obj of b.objects ?? []) {
        const parts = strings(obj.List?.items ?? obj.ObjectWithArgs?.objname ?? (obj.String ? [obj] : []))
        owned(parts.length > 1 ? parts[0] : parts[0] ?? null, `drops ${parts.join('.')}`)
      }
      break
    case 'GrantStmt':
      for (const obj of b.objects ?? []) {
        const schema = obj.String?.sval ?? obj.RangeVar?.schemaname ?? strings(obj.ObjectWithArgs?.objname)[0] ?? null
        if (b.objtype === 'OBJECT_SCHEMA' || obj.RangeVar || obj.ObjectWithArgs) {
          owned(schema, `${b.is_grant ? 'grants' : 'revokes'} on ${schema}`)
        }
      }
      break
    case 'VariableSetStmt':
      if (b.name === 'search_path' && o.kind !== 'core') {
        fail('sets search_path: every name is qualified instead')
      }
      break
    case 'DoStmt':
      if (o.kind !== 'core') {
        fail('holds a DO block, which the SQL check cannot see into; write a function')
      }
      break
    case 'InsertStmt':
      if (b.relation.schemaname === cites.schema && b.relation.relname === cites.table) {
        citing(b, o, found)
      }
    // falls through
    case 'UpdateStmt':
    case 'DeleteStmt':
      if (b.relation.schemaname === 'cella' && o.kind !== 'core') {
        if (type !== 'InsertStmt' || !registries.has(b.relation.relname)) {
          fail(`writes ${named(b.relation)}: a ${o.kind} writes cella.* only to register its rules, its powers, its personal columns or the keyring`)
        } else if (b.relation.relname === 'keyring' && o.kind !== 'feat') {
          fail(`registers the keyring: only a feat resolves device keys, not ${o.kind} ${o.name}`)
        } else {
          registers(b, o, s, fail, found)
        }
      }
      break
  }
}

// A registration under its owner's name: a rule on an op of a feat it may
// see; a power only on an op of its own. Literal power rows are collected
// for feat-check to compare with ops.ts.
function registers(b, o, s, fail, found) {
  const what = b.relation.relname
  const cols = (b.cols ?? []).map((c) => c.ResTarget.name)
  const literal = (v) => (v.A_Const?.isnull ? null : v.A_Const?.sval?.sval)
  for (const row of b.selectStmt?.SelectStmt?.valuesLists ?? []) {
    const vals = Object.fromEntries(row.List.items.map((v, i) => [cols[i], literal(v)]))
    const feat = vals.op?.split(':')[0]
    if (what === 'rule' && vals.op && !s.ops.includes(feat)) {
      fail(`registers a rule on ${vals.op}, an op of ${feat}, which ${o.name} neither joins nor builds on`)
    }
    if (what === 'power' && feat !== o.name) {
      fail(`registers a power on ${vals.op}, an op of ${feat}: only ${feat} names what its ops need`)
    }
    if (vals.owner !== undefined && vals.owner !== o.name) {
      fail(`registers a ${what} as ${vals.owner}, not as itself, ${o.name}`)
    }
    if (what === 'rule' && vals.op) {
      found.rules.push({ op: vals.op, owner: o.name })
    }
    if (what === 'power' && vals.op) {
      found.powers.push({ op: vals.op, power: vals.power ?? null, amount: vals.amount ?? null, owner: o.name })
    }
    if (what === 'personal') {
      if (vals.schema !== s.own) {
        fail(`registers ${vals.schema}.${vals.tab}.${vals.col} as personal: a ${o.kind} registers only its own schema's columns`)
      }
      found.personal.push(`${vals.schema}.${vals.tab}.${vals.col}`)
    }
  }
  if (what === 'personal' && !b.selectStmt?.SelectStmt?.valuesLists) {
    fail('registers personal columns from a query: each is a literal row, so feat-check can see it')
  }
  if (what === 'power' && !b.selectStmt?.SelectStmt?.valuesLists) {
    fail('registers powers from a query: a power is a literal row, so feat-check can compare it with ops.ts')
  }
}

// PL/pgSQL keeps its statements as text: each is parsed in the mode it
// was written in. `fn` is one CREATE FUNCTION statement's text.
function plpgsql(lib, fn) {
  const trees = []
  const queries = []
  walk(lib.parsePlPgSQLSync(fn), (_, n) => {
    if (n.PLpgSQL_expr) {
      queries.push(n.PLpgSQL_expr)
    }
  })
  for (const { query, parseMode } of queries) {
    const text = parseMode === 0 || parseMode === undefined
      ? query
      : `SELECT ${parseMode >= 3 ? query.replace(/^[^:]*:=/, '') : query}`
    trees.push(lib.parseSync(text))
  }
  return trees
}

// Collects what the SQL registers as literal rows, for feat-check to
// compare with each op's label: the powers in cella.power, the rules in
// cella.rule, and the ops that cite a decision in decision.cites.
export async function checkSql(repo, apps, known, found = { powers: [], rules: [], cites: [], personal: [], impersonal: [], columns: [] }) {
  const lib = await import('libpg-query')
  await lib.loadModule?.()
  const errors = []
  for (const o of owners(repo, apps)) {
    const s = scope(o)
    for (const file of readdirSync(join(repo, o.dir)).filter((f) => f.endsWith('.sql')).sort()) {
      const path = join(o.dir, file)
      const fail = (msg) => errors.push(`${path}: ${msg}`)
      const sql = readFileSync(join(repo, path), 'utf8')
      let tree
      try {
        tree = lib.parseSync(sql)
      } catch (e) {
        fail(`does not parse: ${e.message}`)
        continue
      }
      found.at = path
      inspect(tree, o, s, known, fail, found)
      // Locations are byte offsets.
      const bytes = Buffer.from(sql)
      const bodies = []
      for (const { stmt, stmt_location: at = 0, stmt_len: len = 0 } of tree.stmts) {
        const fn = stmt.CreateFunctionStmt
        if (!fn) {
          continue
        }
        const opt = (k) => fn.options?.find((x) => x.DefElem.defname === k)?.DefElem.arg
        const lang = opt('language')?.String?.sval
        const as = strings(opt('as')?.List?.items)[0]
        if (lang === 'sql' && as) {
          bodies.push(lib.parseSync(as))
        } else if (lang === 'plpgsql') {
          bodies.push(...plpgsql(lib, bytes.subarray(at, len ? at + len : undefined).toString()))
        } else if (lang !== 'sql') {
          fail(`${strings(fn.funcname).join('.')} is LANGUAGE ${lang}; a feat's SQL is sql or plpgsql`)
        }
      }
      for (const body of bodies) {
        inspect(body, o, s, known, fail, found)
      }
    }
  }
  return errors
}

// Every sql/ directory sits beside a core package or in a graft.
export function placed(repo, apps) {
  const dirs = new Set(owners(repo, apps).map((o) => o.dir))
  const errors = []
  const visit = (dir) => {
    for (const name of readdirSync(join(repo, dir), { withFileTypes: true })) {
      if (!name.isDirectory() || ['node_modules', 'target'].includes(name.name)) {
        continue
      }
      const path = join(dir, name.name)
      if (name.name === 'sql' && !dirs.has(path)) {
        errors.push(`${path}: SQL sits in a node's core/sql/, a feat's core/sql/ or a graft's sql/`)
      }
      visit(path)
    }
  }
  apps.forEach(visit)
  return errors
}

export const schemaName = schemaOf
