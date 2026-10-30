// SQL boundaries: parses every sql/*.sql on the feat tree with libpg_query,
// Postgres's own parser, and refuses any reference the tree does not allow.
//
//   SQL in            may reference
//   a node's core     cella.*; the notary's vault; the catalog; the
//                     analytics port's own schema, analytics, in its SQL
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
//     with its ops.ts; a feat only, the keyring (cella.keyring); the
//     powers that read the rows of its own feat or of the feats it joins
//     (cella.reading); and, a graft only, the authority that says who
//     holds a power (cella.authority) and the functions that open the
//     rows of the feats it joins to more readers (cella.reach);
//   - never sets search_path but on a function, to the catalog;
//   - never reads the clock or randomness, since rules read
//     cella.verdict_date(), and has no DO block, which this check cannot
//     see into;
//   - writes and triggers on no table outside its own schema and cella.*:
//     each such write or trigger its migrations leave standing is
//     collected (`found.foreign`) and refused unless the app's
//     foreign.list still names it (writes.mjs).
//   - grants nothing to cella_analytics, which `cella migrate` grants
//     only the views the slices publish.
// A slice's analytical contract, its sql/analytics.sql, holds only views
// in its own schema and comments on them. A view reads as its owner, never
// security_invoker, so the role needs no grant on a table, and it shares:
//   - a column registered in cella.personal only where the view's column
//     is commented 'personal: why';
//   - from a table under row-level security, or a view over one, only
//     sums: the view aggregates at its top level and groups by no column
//     a policy compares with cella.reader(), but where that column is
//     shown and commented personal.
// A view any slice makes over a secured table is secured in turn. What a
// view reads through a function runs as the role, and is caught when
// cella migrate reads each view as it, or by review.
// No core publishes a contract but the analytics port, org's core library
// `analytics`, whose views stay in its schema: the log's head.
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
    return { own: null, allowed: new Set(['cella', 'vault', ...catalog, ...(PORT.test(o.dir) ? ['analytics'] : [])]), feats: [], ops: [] }
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

const registries = new Set(['rule', 'power', 'keyring', 'personal', 'reading', 'reach', 'authority'])

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
    case 'ViewStmt': {
      owned(b.view.schemaname, `creates ${named(b.view)}`)
      // A view over a table under row-level security hides it: it is
      // secured in turn, for a contract that reads it.
      if (read(b.query).some((t) => found.secured.has(t))) {
        found.secured.add(named(b.view))
      }
      carry(b, found)
      break
    }
    case 'IndexStmt':
    case 'AlterTableStmt':
      owned(b.relation.schemaname, `${type === 'IndexStmt' ? 'indexes' : 'alters'} ${named(b.relation)}`)
      if (type === 'AlterTableStmt' && (b.cmds ?? []).some((c) => c.AlterTableCmd?.subtype === 'AT_EnableRowSecurity')) {
        found.secured.add(named(b.relation))
      }
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
    case 'CreatePolicyStmt':
      owned(b.table.schemaname, `creates the policy ${b.policy_name} on ${named(b.table)}`)
      for (const col of readers(b.qual)) {
        found.readers.add(`${named(b.table)}.${col}`)
      }
      // A row whose column is null is every reader's: `holder IS NULL OR …`.
      walk(b.qual, (key, n) => {
        if (key === 'NullTest' && n.nulltesttype === 'IS_NULL' && n.arg?.ColumnRef) {
          found.open.add(`${named(b.table)}.${strings(n.arg.ColumnRef.fields).at(-1)}`)
        }
      })
      break
    case 'AlterFunctionStmt': {
      const f = strings(b.func?.objname)
      owned(f.length > 1 ? f[0] : null, `alters ${f.join('.')}`)
      for (const a of b.actions ?? []) {
        const set = a.DefElem.defname === 'set' ? a.DefElem.arg.VariableSetStmt : null
        if (set?.name === 'search_path' && (set.args ?? []).some((v) => !catalog.has(v.A_Const?.sval?.sval))) {
          fail(`${f.join('.')} sets search_path beyond the catalog: only the catalog, and every name qualified`)
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
        // Its own trigger on another's table, which it drops to stop
        // writing there.
        if (b.removeType === 'OBJECT_TRIGGER' && s.triggers?.has(parts.join('.'))) {
          continue
        }
        owned(parts.length > 1 ? parts[0] : parts[0] ?? null, `drops ${parts.join('.')}`)
      }
      break
    case 'GrantStmt':
      if ((b.grantees ?? []).some((g) => g.RoleSpec?.rolename === 'cella_analytics')) {
        fail(`${b.is_grant ? 'grants' : 'revokes'} to cella_analytics: cella migrate grants it the views each slice's analytics.sql publishes, and nothing else`)
      }
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
          fail(`writes ${named(b.relation)}: a ${o.kind} writes cella.* only to register its rules, its powers, its personal columns, the keyring or who reads`)
        } else if (b.relation.relname === 'keyring' && o.kind !== 'feat') {
          fail(`registers the keyring: only a feat resolves device keys, not ${o.kind} ${o.name}`)
        } else if (['reach', 'authority'].includes(b.relation.relname) && o.kind !== 'graft') {
          fail(`registers cella.${b.relation.relname}: only a graft opens a feat's rows to more readers, not ${o.kind} ${o.name}`)
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
    if ((what === 'reading' || what === 'reach') && !s.feats.includes(vals.what)) {
      fail(`registers who reads ${vals.what}: a ${o.kind} says who reads only ${s.feats.join(', ')}`)
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
  if (['reading', 'reach', 'authority'].includes(what) && !b.selectStmt?.SelectStmt?.valuesLists) {
    fail(`registers cella.${what} from a query: each is a literal row, so the check can see it`)
  }
  if (what === 'power' && !b.selectStmt?.SelectStmt?.valuesLists) {
    fail('registers powers from a query: a power is a literal row, so feat-check can compare it with ops.ts')
  }
}

// A slice's analytical contract: views in its own schema, read as their
// owner, and comments on them; personal columns shown only where
// declared, and a secured table's rows only as sums.
const CONTRACT = 'analytics.sql'
// The analytics port's own SQL, org's core library beside the slices: its
// schema, `analytics`, and its contract, the log's head each run of the
// shell is stamped with. No other core publishes a contract.
const PORT = /(^|\/)core\/analytics\/sql$/
const aggregates = new Set(['sum', 'count', 'avg', 'min', 'max', 'bool_and', 'bool_or', 'every', 'array_agg', 'string_agg', 'jsonb_agg', 'jsonb_object_agg'])

// The tables and views a query reads, qualified, its subqueries' and CTEs'
// among them.
function read(query) {
  const out = []
  walk(query, (key, n) => {
    if (key === 'RangeVar' && n.schemaname) {
      out.push(`${n.schemaname}.${n.relname}`)
    }
  })
  return out
}

// The columns a policy's test says whose a row is by: compared with
// cella.reader(), or the key cella.reaches() opens a row by.
function readers(qual) {
  const out = []
  walk(qual, (key, n) => {
    if (key === 'FuncCall' && strings(n.funcname).join('.') === 'cella.reaches') {
      const col = strings(n.args?.[1]?.ColumnRef?.fields).at(-1)
      if (col) {
        out.push(col)
      }
    }
  })
  const isReader = (n) => {
    let hit = false
    walk(n, (key, x) => {
      if (key === 'FuncCall' && strings(x.funcname).join('.') === 'cella.reader') {
        hit = true
      }
    })
    return hit
  }
  walk(qual, (key, n) => {
    if (key === 'A_Expr' && strings(n.name)[0] === '=') {
      for (const [a, b] of [[n.lexpr, n.rexpr], [n.rexpr, n.lexpr]]) {
        const col = strings(a?.ColumnRef?.fields).at(-1)
        if (col && isReader(b)) {
          out.push(col)
        }
      }
    }
  })
  return out
}

// A view's shape: its name, its columns' names, the arms of its set
// operation, and how a column reference resolves to the columns of the
// tables it names, `schema.table.column`.
function shape(v) {
  const view = `${v.view.schemaname}.${v.view.relname}`
  const tables = new Map()
  walk(v.query, (key, n) => {
    if (key === 'RangeVar' && n.schemaname) {
      tables.set(n.alias?.aliasname ?? n.relname, `${n.schemaname}.${n.relname}`)
    }
  })
  // Its table's column by alias, or any named table's.
  const resolve = (ref) => {
    const f = strings(ref.fields)
    if (f.length >= 2) {
      const t = tables.get(f.at(-2))
      return t ? [`${t}.${f.at(-1)}`] : []
    }
    return f.length ? [...new Set(tables.values())].map((t) => `${t}.${f[0]}`) : []
  }
  const arms = (q) => (q?.op && q.op !== 'SETOP_NONE' ? [...arms(q.larg), ...arms(q.rarg)] : [q])
  const selects = arms(v.query.SelectStmt)
  const names = (v.aliases ?? []).map((a) => a.String?.sval)
  selects[0].targetList?.forEach((t, i) => {
    names[i] ??= t.ResTarget.name ?? strings(t.ResTarget.val?.ColumnRef?.fields).at(-1)
  })
  return { view, names, selects, resolve }
}

const aggregate = (x) => !x.over && (x.agg_star || aggregates.has(strings(x.funcname).at(-1)))

// The columns an expression references, every one or only those outside
// an aggregate, which a sum over the rows shows no single value of.
function refs(n, shown = false) {
  const out = []
  const visit = (key, x) => {
    if (key === 'ColumnRef') {
      out.push(x)
      return
    }
    if (shown && key === 'FuncCall' && aggregate(x)) {
      return
    }
    if (Array.isArray(x)) {
      x.forEach((y) => visit(key, y))
    } else if (x && typeof x === 'object') {
      for (const [k, y] of Object.entries(x)) {
        visit(k, y)
      }
    }
  }
  visit(null, n)
  return out
}

// What a view shows of a column that is personal or says whose a row is
// carries over to its own column, for a contract that reads the view.
function carry(v, found) {
  const { view, names, selects, resolve } = shape(v)
  for (const q of selects) {
    q.targetList?.forEach((t, i) => {
      const cols = refs(t.ResTarget.val, true).flatMap(resolve)
      if (cols.some((c) => found.readers.has(c))) {
        found.readers.add(`${view}.${names[i]}`)
      }
      if (cols.some((c) => found.personal.includes(c) || found.carried.has(c))) {
        found.carried.add(`${view}.${names[i]}`)
      }
    })
  }
}

function contract(tree, o, fail, found) {
  if (o.kind === 'core') {
    if (!PORT.test(o.dir)) {
      fail('an analytical contract is a feat\'s or a graft\'s, never a core\'s but the analytics port\'s')
      return
    }
    for (const { stmt } of tree.stmts ?? []) {
      if (stmt.ViewStmt && stmt.ViewStmt.view?.schemaname !== 'analytics') {
        fail(`${stmt.ViewStmt.view?.relname}: the analytics port publishes only in its own schema, analytics`)
      }
    }
  }
  // The view columns the contract declares, personal or not.
  const declared = new Set()
  for (const { stmt } of tree.stmts ?? []) {
    const [type, b] = Object.entries(stmt)[0]
    if (type === 'CommentStmt' && ['OBJECT_COLUMN', 'OBJECT_VIEW'].includes(b.objtype)) {
      if (b.objtype === 'OBJECT_COLUMN' && /^(not )?personal: ./.test(b.comment ?? '')) {
        declared.add(strings(b.object?.List?.items).join('.'))
      }
    } else if (type !== 'ViewStmt') {
      fail(`holds ${type.replace(/Stmt$/, '')}: an analytical contract holds only views and comments on them`)
    }
  }
  const personal = (c) => found.personal.includes(c) || found.carried.has(c)
  for (const { stmt } of tree.stmts ?? []) {
    const v = stmt.ViewStmt
    if (!v) {
      continue
    }
    const { view, names, selects, resolve } = shape(v)
    if ((v.options ?? []).some((d) => d.DefElem?.defname === 'security_invoker')) {
      fail(`${view} is security_invoker: a contract's view reads as its owner, so cella_analytics needs no grant on a table`)
    }
    for (const q of selects) {
      q.targetList?.forEach((t, i) => {
        const shown = refs(t.ResTarget.val, true).flatMap(resolve).filter(personal)
        if (shown.length && !declared.has(`${view}.${names[i]}`)) {
          fail(`${view}.${names[i]} shows ${shown[0]}, which is personal: comment the view's column 'personal: why' or 'not personal: why', or leave it out`)
        }
      })
      const secured = read(q).filter((t) => found.secured.has(t))
      if (!secured.length) {
        continue
      }
      const sums = (q.groupClause ?? []).length > 0 ||
        (q.targetList ?? []).some((t) => refs(t.ResTarget.val).length > refs(t.ResTarget.val, true).length || JSON.stringify(t).includes('"agg_star":true'))
      // The rows a policy opens to every reader, kept by `col IS NULL` in
      // the view's own test.
      const kept = new Set()
      const tests = q.whereClause?.BoolExpr?.boolop === 'AND_EXPR' ? q.whereClause.BoolExpr.args : [q.whereClause]
      for (const t of tests) {
        if (t?.NullTest?.nulltesttype === 'IS_NULL' && t.NullTest.arg?.ColumnRef) {
          resolve(t.NullTest.arg.ColumnRef).filter((c) => found.open.has(c)).forEach((c) => kept.add(c.split('.').slice(0, 2).join('.')))
        }
      }
      const shut = secured.filter((t) => !kept.has(t))
      if (!sums && shut.length) {
        fail(`${view} shows the rows of ${shut[0]}, which is under row-level security: a contract shows its rows only as sums, or those its policy opens to everyone`)
      }
      for (const g of q.groupClause ?? []) {
        const whose = refs(g).flatMap(resolve).find((c) => found.readers.has(c))
        if (!whose) {
          continue
        }
        const i = (q.targetList ?? []).findIndex((t) => refs(t.ResTarget.val, true).flatMap(resolve).includes(whose))
        if (i < 0 || !declared.has(`${view}.${names[i]}`)) {
          fail(`${view} sums by ${whose}, which says whose a row is: show it as a column commented 'personal: why' or 'not personal: why', or sum over everyone`)
        }
      }
    }
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
export async function checkSql(repo, apps, known, found = { powers: [], rules: [], cites: [], personal: [], impersonal: [], columns: [], foreign: [] }) {
  const lib = await import('libpg-query')
  await lib.loadModule?.()
  const errors = []
  found.foreign ??= []
  found.secured ??= new Set()
  found.readers ??= new Set()
  found.open ??= new Set()
  found.carried ??= new Set()
  for (const o of owners(repo, apps)) {
    const s = scope(o)
    // What the owner's migrations leave writing or triggering on a table
    // it does not own, by key, file by file: a later file's drop or
    // replacement takes a trigger or a function away.
    const foreign = new Map()
    s.triggers = new Set()
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
      if (file === CONTRACT) {
        contract(tree, o, fail, found)
      }
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
      if (o.kind !== 'core') {
        foreignIn(lib, tree, bytes, file, path, o, s, foreign)
      }
    }
    found.foreign.push(...foreign.values())
  }
  return errors
}

// A table outside the owner's schema and the notary's: a feat's, a
// lower-order graft's, a parent feat's.
const foreignTable = (rv, s) => rv?.schemaname && rv.schemaname !== s.own && rv.schemaname !== 'cella'

// The tables a statement tree writes, its data-modifying CTEs among them.
function written(tree) {
  const out = []
  walk(tree, (key, n) => {
    if (['InsertStmt', 'UpdateStmt', 'DeleteStmt', 'MergeStmt'].includes(key)) {
      out.push(n.relation)
    }
    if (key === 'TruncateStmt') {
      out.push(...(n.relations ?? []).map((r) => r.RangeVar))
    }
  })
  return out
}

// One file's foreign writes and triggers, applied to what the owner's
// earlier files left: a trigger on another's table, a function whose body
// writes one, a statement the migration itself runs on one. Dropping the
// trigger or the function, or replacing the function, takes its entries
// away.
function foreignIn(lib, tree, bytes, file, path, o, s, foreign) {
  const add = (what) => foreign.set(what, { owner: o.name, what, path })
  const drop = (prefix) => [...foreign.keys()].filter((k) => k.startsWith(prefix)).forEach((k) => foreign.delete(k))
  const fnKey = (parts) => `${parts.join('.')}()`
  for (const { stmt, stmt_location: at = 0, stmt_len: len = 0 } of tree.stmts ?? []) {
    const [type, b] = Object.entries(stmt)[0]
    if (type === 'CreateTrigStmt') {
      if (foreignTable(b.relation, s)) {
        s.triggers.add(`${b.relation.schemaname}.${b.relation.relname}.${b.trigname}`)
        add(`trigger ${b.trigname} on ${b.relation.schemaname}.${b.relation.relname}`)
      }
    } else if (type === 'DropStmt' && b.removeType === 'OBJECT_TRIGGER') {
      for (const obj of b.objects ?? []) {
        const [schema, table, name] = strings(obj.List?.items)
        foreign.delete(`trigger ${name} on ${schema}.${table}`)
      }
    } else if (type === 'DropStmt' && ['OBJECT_FUNCTION', 'OBJECT_PROCEDURE'].includes(b.removeType)) {
      for (const obj of b.objects ?? []) {
        drop(`${fnKey(strings(obj.ObjectWithArgs?.objname))} writes `)
      }
    } else if (type === 'CreateFunctionStmt') {
      const name = fnKey(strings(b.funcname))
      drop(`${name} writes `)
      const opt = (k) => b.options?.find((x) => x.DefElem.defname === k)?.DefElem.arg
      const lang = opt('language')?.String?.sval
      const as = strings(opt('as')?.List?.items)[0]
      const bodies = lang === 'sql' && as
        ? [lib.parseSync(as)]
        : lang === 'plpgsql' ? plpgsql(lib, bytes.subarray(at, len ? at + len : undefined).toString()) : []
      for (const rv of bodies.flatMap(written).filter((rv) => foreignTable(rv, s))) {
        add(`${name} writes ${rv.schemaname}.${rv.relname}`)
      }
    } else {
      for (const rv of written(stmt).filter((rv) => foreignTable(rv, s))) {
        add(`${file} writes ${rv.schemaname}.${rv.relname}`)
      }
    }
  }
}

// Every sql/ directory sits beside a core package or in a graft, but an
// extension's: beside its control file, its install and upgrade scripts,
// `<extension>--<version>.sql` and `<extension>--<from>--<to>.sql`, which
// Postgres runs and no migration does.
const extension = (repo, dir) =>
  readdirSync(join(repo, dirname(dir))).some((f) => f.endsWith('.control')) &&
  readdirSync(join(repo, dir)).every((f) => /^[a-z_]+--[0-9a-z.-]+\.sql$/.test(f))

export function placed(repo, apps) {
  const dirs = new Set(owners(repo, apps).map((o) => o.dir))
  const errors = []
  const visit = (dir) => {
    for (const name of readdirSync(join(repo, dir), { withFileTypes: true })) {
      if (!name.isDirectory() || ['node_modules', 'target'].includes(name.name)) {
        continue
      }
      const path = join(dir, name.name)
      if (name.name === 'sql' && !dirs.has(path) && !extension(repo, path)) {
        errors.push(`${path}: SQL sits in a node's core/sql/, a feat's core/sql/ or a graft's sql/`)
      }
      visit(path)
    }
  }
  apps.forEach(visit)
  return errors
}

export const schemaName = schemaOf
