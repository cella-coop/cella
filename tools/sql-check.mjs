// SQL boundaries: parses every sql/*.sql on the feat tree with libpg_query,
// Postgres's own parser, and refuses any reference the tree does not allow.
//
//   SQL in            may reference
//   a node's core     cella.*; the notary's vault; the catalog; a core
//                     library's own schema, named for it, in its SQL
//                     (analytics, the port's; policy, the register's;
//                     circle, the circles'), and the schemas of the core
//                     libraries its package depends on
//   a feat            its own schema; those of the feats it nests in;
//                     cella.*; core's circles; the policy register; the
//                     catalog
//   a graft           its own schema; the schemas of the feats it joins and
//                     of the feats they nest in; the schemas of the grafts
//                     at or below its node that join a proper subset of its
//                     feats; cella.*; core's circles; the policy register;
//                     the catalog
//
// A slice reads the policy register's policies and values, never their
// wording, policy.wording: a guard reads a policy's values from its own
// columns, copied there at adoption, and never parses the sentence.
//
// Beyond the references, a feat's or a graft's SQL:
//   - creates, alters, drops, indexes and grants only in its own schema;
//   - holds no foreign key out of its own schema, but its owning circle's
//     into core's circle table;
//   - names its owning circle in every table, `circle`, text, never null,
//     a foreign key into circle.circle, unless the table is a registry
//     its migrations fill, commented 'registry: why' (`unowned`);
//   - writes cella.* only to register, under its own name: its guards, on
//     ops of its own feat, of the feats it joins, of the lower-order
//     grafts it builds on or of core's circles (cella.guard); the power
//     each of its own ops needs (cella.power), which feat-check compares
//     with its actions.ts; a feat only, the keyring (cella.keyring); the
//     powers that read the rows of its own feat or of the feats it joins
//     (cella.reading); the authority that says who holds a power
//     (cella.authority); and, a graft only, the functions that open the
//     rows of the feats it joins to more readers (cella.reach);
//   - never sets search_path but on a function, to the catalog;
//   - never reads the clock or randomness, since guards read
//     cella.verdict_date(), and has no DO block, which this check cannot
//     see into;
//   - writes and triggers on no table outside its own schema and cella.*:
//     each such write or trigger its migrations leave standing is
//     collected (`found.foreign`) and refused (writes.mjs).
//   - grants nothing to cella_analytics, which `cella migrate` grants
//     only the views the slices publish.
//   - never disables nor unforces row-level security, which core's
//     circles put every table under as it is made; reads a table that
//     drops core's policy `circle` by a policy of its own; and makes no
//     policy that reads but by a known pattern (`pattern`), or one
//     opening rows to every reader commented 'shared: why' (`unread`);
//   - makes no SECURITY DEFINER function returning rows that is not
//     declared, 'audience: shared by <columns>: why' or 'audience: keyed
//     by <argument>: why', and keeps a declared one to the shared-total
//     rules: it sums, or filters its rows by its reader's test, or a keyed
//     one matches them by its argument's digest (`definers`);
//   - makes no view that reads as its owner, beside its contract, unless
//     it is declared 'audience: shared by <columns>: why' or 'audience:
//     shared: why' and keeps it: it sums by exactly the columns it names
//     and none that says whose a row is, or filters its rows by its
//     reader's test; every other view is security_invoker (`unshared`).
// A slice's analytical contract, its sql/analytics.sql, holds only views
// in its own schema and comments on them. A view reads as its owner, never
// security_invoker, so the role needs no grant on a table, and it shares:
//   - a column registered in cella.personal only where the view's column
//     is commented 'personal: why';
//   - from a table under row-level security, or a view over one, only
//     sums: the view aggregates at its top level and groups by no column
//     a policy compares with cella.reader(), but where that column is
//     shown and commented personal.
// Each view declares its audience in its comment:
//   - 'audience: scoped by <circle>[ and <whose>]': one row per record,
//     never a sum, its circle column a record's owning circle, and the
//     column that says whose a row is named where it is shown;
//   - 'audience: shared[ by <columns>]': sums grouped by exactly the
//     columns it names, at its top level or in a view it shows the rows
//     of, or the rows of tables no circle owns. It shows no row of a
//     record a circle owns.
// A view any slice makes over a secured table is secured in turn, and one
// over a table that names its owning circle is owned in turn. What a
// view reads through a function runs as the role, and is caught when
// cella migrate reads each view as it, or by review.
// No core publishes a contract but the analytics port, org's core library
// `analytics`, whose views stay in its schema: the log's head; and core's
// circles, `circle`, whose views stay in theirs.
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
        out.push({ dir: join(core, lib, 'sql'), ...owner, ...(feat ? {} : { lib, uses: uses(repo, core, lib) }) })
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

// The core libraries with SQL of their own that a core library's package
// depends on, by name: its SQL may reference their schemas.
function uses(repo, core, lib) {
  const pkg = join(repo, core, lib, 'ts', 'package.json')
  const deps = existsSync(pkg) ? Object.keys(JSON.parse(readFileSync(pkg, 'utf8')).dependencies ?? {}) : []
  return deps
    .map((d) => d.match(/^@cella\/[a-z]+-([a-z]+)$/)?.[1])
    .filter((d) => d && d !== lib && existsSync(join(repo, core, d, 'sql')))
}

// The schemas an owner's SQL may reference, and its own.
function scope(o) {
  if (o.kind === 'core') {
    return { own: null, allowed: new Set(['cella', 'vault', ...catalog, ...(o.lib ? [o.lib, ...o.uses] : [])]), feats: [], ops: [] }
  }
  if (o.kind === 'feat') {
    return { own: o.name, allowed: new Set([o.name, ...o.lineage, 'cella', CIRCLES, REGISTER, ...catalog]), feats: [o.name], ops: [o.name, CIRCLES] }
  }
  const feats = o.name.split('-')
  const outer = feats.flatMap((f) => o.nests.get(f) ?? [])
  const lower = o.grafts.filter((g) => {
    const parts = g.split('-')
    return parts.length < feats.length && parts.every((p) => feats.includes(p))
  })
  return { own: schemaOf(o.name), allowed: new Set([schemaOf(o.name), ...feats, ...outer, ...lower.map(schemaOf), 'cella', CIRCLES, REGISTER, ...catalog]), feats, ops: [o.name, ...feats, ...lower, CIRCLES] }
}

// Core's circles, org's core library `circle`: the circles, roles,
// tenures, seats and mandates, which every feat and graft builds on and
// whose ops each may guard, as groups are in standard RBAC.
const CIRCLES = 'circle'

// The policy register, org's core library `policy`, which every slice
// reads: its policies and their values, never their wording.
const REGISTER = 'policy'

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
      if (n.schemaname === REGISTER && n.relname === 'wording' && o.kind !== 'core') {
        fail(`reads ${named(n)}: a guard reads a policy's values from its own columns, never its wording`)
      }
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
        fail(`calls ${f.join('.')}(): guards read cella.verdict_date(), never the clock or randomness`)
      }
    }
    if (n.FuncCall) {
      registersBy(n.FuncCall, o, fail, found)
    }
    if (n.SQLValueFunction && o.kind !== 'core') {
      fail(`reads ${n.SQLValueFunction.op.replace('SVFOP_', '').toLowerCase()}: guards read cella.verdict_date(), never the clock`)
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

const registries = new Set(['guard', 'power', 'keyring', 'personal', 'reading', 'reach', 'authority'])

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

// Core's circle table, the one table outside its own schema a feat's or
// a graft's table may hold a foreign key into: the record's owning
// circle.
const circleTable = (rv) => rv?.schemaname === 'circle' && rv?.relname === 'circle'

// Whether a table's columns name its owning circle: `circle`, text, never
// null, a foreign key into core's circle table, by the column or by a
// constraint of the table.
function owning(defs) {
  const col = (defs ?? []).map((d) => d.ColumnDef).find((c) => c?.colname === 'circle')
  if (!col || strings(col.typeName?.names).at(-1) !== 'text') {
    return false
  }
  const kinds = (col.constraints ?? []).map((c) => c.Constraint)
  const required = kinds.some((c) => c?.contype === 'CONSTR_NOTNULL' || c?.contype === 'CONSTR_PRIMARY')
  const keyed =
    kinds.some((c) => c?.contype === 'CONSTR_FOREIGN' && circleTable(c.pktable)) ||
    (defs ?? []).some((d) => d.Constraint?.contype === 'CONSTR_FOREIGN' && circleTable(d.Constraint.pktable) && strings(d.Constraint.fk_attrs).join() === 'circle')
  return required && keyed
}

// The tables of a feat or a graft that name no owning circle and are no
// registry, a table its migrations fill, the same in every scope, which
// is commented 'registry: why'.
export function unowned(found) {
  const registries = found.registries ?? new Set()
  return (found.tables ?? [])
    .filter((t) => !t.owned && !registries.has(t.key))
    .map((t) => `${t.path}: ${t.key} names no owning circle: give it circle text NOT NULL REFERENCES circle.circle, or comment it 'registry: why'`)
}

// A row-level policy a slice makes, by its table and name: whether it
// reads (FOR SELECT or ALL, permissive), whether it is the guards role's
// alone, and whether its test is of a known pattern.
function policy(b, s, found) {
  const table = `${b.table.schemaname}.${b.table.relname}`
  const roles = (b.roles ?? []).map((r) => (r.RoleSpec?.roletype === 'ROLESPEC_PUBLIC' ? 'public' : r.RoleSpec?.rolename))
  const map = (found.policies ??= new Map()).get(table) ?? new Map()
  found.policies.set(table, map)
  map.set(b.policy_name, {
    name: b.policy_name,
    path: found.at,
    reads: ['all', 'select'].includes(b.cmd_name) && b.permissive === true,
    guards: roles.length > 0 && roles.every((r) => r === 'cella_guards'),
    known: b.qual ? pattern(b.qual, s, found) : false,
  })
}

// Whether a policy's test is of a known pattern (architecture.md,
// "Reading"): an OR of the terms below, each opening no more than a
// mandate, the reader's own row or a graft's reach does. An AND reads no
// more than any of its parts, so it is known where one part is.
//   (SELECT cella.sees('<feat>'))           a write's transaction
//   (SELECT cella.writing())                the same, on a secret ballot
//   circle = ANY ((SELECT cella.circles('<feat>'))::text[])
//   circle = ANY ((SELECT circle.reads('{<feat>,…}'))::text[])
//   <column> = cella.reader()               the reader's own rows, or
//   cella.reader() IN (<column>, …)         those of any of its columns
//   cella.reaches('<feat>', <column>)       a graft's reach
//   EXISTS (SELECT FROM <its own table> …)  a row of a table of its own,
//                                           read under that table's policy
// where '<feat>' is the slice's own name or, a graft's, a feat it joins.
// In a definer function, which reads as its owner, a superuser,
// cella.sees answers for the owner and a table of its own reads past its
// policy: there the test reads (SELECT circle.whole()), which asks the
// session's login, in their place.
function pattern(qual, s, found, definer = false) {
  const names = new Set([s.own, ...s.feats])
  const lit = (n) => n?.A_Const?.sval?.sval
  const call = (n) => (n?.FuncCall ? { fn: strings(n.FuncCall.funcname).join('.'), args: n.FuncCall.args ?? [] } : null)
  const asked = (n) => {
    const q = n?.SubLink?.subLinkType === 'EXPR_SUBLINK' ? n.SubLink.subselect?.SelectStmt : null
    return q && !q.fromClause && q.targetList?.length === 1 ? call(q.targetList[0].ResTarget?.val) : null
  }
  const column = (n, name) => {
    const f = strings(n?.ColumnRef?.fields)
    return f.length > 0 && (!name || f.at(-1) === name)
  }
  const reader = (n) => call(n)?.fn === 'cella.reader' && call(n).args.length === 0
  const own = new Set((found.tables ?? []).filter((t) => t.key.split('.')[0] === s.own).map((t) => t.key))
  const term = (n) => {
    const bool = n?.BoolExpr
    if (bool?.boolop === 'OR_EXPR') {
      return bool.args.every(term)
    }
    if (bool?.boolop === 'AND_EXPR') {
      return bool.args.some(term)
    }
    const a = asked(n)
    if (!definer && a?.fn === 'cella.sees' && a.args.length === 1 && names.has(lit(a.args[0]))) {
      return true
    }
    if (definer && a?.fn === 'circle.whole' && a.args.length === 0) {
      return true
    }
    if (a?.fn === 'cella.writing' && a.args.length === 0) {
      return true
    }
    const e = n?.A_Expr
    if (e?.kind === 'AEXPR_OP_ANY' && strings(e.name).join() === '=' && column(e.lexpr, 'circle')) {
      const r = asked(e.rexpr?.TypeCast?.arg)
      const feats = (lit(r?.args[0]) ?? '').match(/^\{(.+)\}$/)?.[1].split(',') ?? []
      if (r?.fn === 'cella.circles' && r.args.length === 1 && names.has(lit(r.args[0]))) {
        return true
      }
      if (r?.fn === 'circle.reads' && r.args.length === 1 && feats.length && feats.every((f) => names.has(f))) {
        return true
      }
    }
    if (e?.kind === 'AEXPR_OP' && strings(e.name).join() === '=' && ((column(e.lexpr) && reader(e.rexpr)) || (reader(e.lexpr) && column(e.rexpr)))) {
      return true
    }
    if (e?.kind === 'AEXPR_IN' && strings(e.name).join() === '=' && reader(e.lexpr) && (e.rexpr?.List?.items ?? []).every((x) => column(x))) {
      return true
    }
    const c = call(n)
    if (c?.fn === 'cella.reaches' && c.args.length === 2 && names.has(lit(c.args[0])) && column(c.args[1])) {
      return true
    }
    if (!definer && n?.SubLink?.subLinkType === 'EXISTS_SUBLINK') {
      let plain = true
      walk(n.SubLink.subselect, (key, x) => {
        if (key === 'RangeVar' && !own.has(`${x.schemaname}.${x.relname}`)) {
          plain = false
        }
        if ((key === 'FuncCall' && strings(x.funcname).join('.') !== 'cella.reader') || key === 'RangeFunction' || key === 'SubLink') {
          plain = false
        }
      })
      return plain
    }
    return false
  }
  return term(qual)
}

// The tables of a feat or a graft that no reader reads by a policy of a
// known pattern, and the policies that read by none (architecture.md,
// "Reading"). Core's circles put each table under row-level security,
// forced, as it is made: a table naming its owning circle under the
// policy `circle`, which a slice may drop for its own, and a registry
// under `registry`, which every reader reads. A slice's policy that reads
// is of a known pattern, or opens rows to every reader and is commented
// 'shared: why'; the guards role's reads the whole.
export function unread(found) {
  const registries = found.registries ?? new Set()
  const out = []
  for (const t of found.tables ?? []) {
    if (!t.owned && !registries.has(t.key)) {
      continue
    }
    const own = [...(found.policies?.get(t.key)?.values() ?? [])].filter((p) => p.reads && !p.guards)
    for (const p of own.filter((p) => !p.known && !p.shared)) {
      out.push(`${p.path}: the policy ${p.name} on ${t.key} reads by no known pattern: read by the owning circle, the reader's own row, a graft's reach or a row of its own table, or comment it 'shared: why'`)
    }
    if (t.owned && found.uncircled?.has(t.key) && own.length === 0) {
      out.push(`${t.path}: ${t.key} drops core's policy circle and has no read policy of its own: give it the personal row's (architecture.md, "Reading")`)
    }
  }
  return out
}

// A function a slice makes, by name: whether it runs as its owner and
// returns rows, a table, a set, a record or a composite, what it takes
// and returns, the query it returns, and its comment. A later CREATE OR
// REPLACE makes it anew; ALTER FUNCTION … SECURITY changes how it runs.
function made(b, name, s, found) {
  const opt = (k) => b.options?.find((x) => x.DefElem.defname === k)?.DefElem.arg
  const params = (b.parameters ?? []).map((p) => p.FunctionParameter)
  const outs = params.filter((p) => ['FUNC_PARAM_OUT', 'FUNC_PARAM_INOUT', 'FUNC_PARAM_TABLE'].includes(p.mode))
  const type = strings(b.returnType?.names)
  const relation = type.length > 1 && type[0] !== 'pg_catalog' && ((found.composites?.has(type.join('.')) ?? false) || (found.tables ?? []).some((t) => t.key === type.join('.')))
  const rows = b.returnType?.setof === true || params.some((p) => p.mode === 'FUNC_PARAM_TABLE') || outs.length > 1 || type.at(-1) === 'record' || relation
  const atomic = b.sql_body?.List?.items?.[0]?.List?.items
  ;(found.functions ??= new Map()).set(name, {
    name,
    path: found.at,
    scope: s,
    definer: opt('security')?.Boolean?.boolval === true,
    rows,
    lang: opt('language')?.String?.sval,
    takes: params.filter((p) => !['FUNC_PARAM_OUT', 'FUNC_PARAM_TABLE'].includes(p.mode)).map((p) => p.name),
    returns: outs.map((p) => p.name),
    body: atomic ? { stmts: atomic.map((stmt) => ({ stmt })) } : strings(opt('as')?.List?.items)[0] ?? null,
    // Its comment outlives a CREATE OR REPLACE, as the function does.
    comment: found.functions?.get(name)?.comment ?? null,
  })
}

// The columns an expression shows: every one but those inside a sum or a
// count, and of a scalar subquery only what it returns.
function shown(n) {
  const out = []
  const visit = (key, x) => {
    if (key === 'ColumnRef') {
      out.push(x)
      return
    }
    if (key === 'FuncCall' && aggregate(x)) {
      return
    }
    if (key === 'SubLink') {
      const arms = (q) => (q?.op && q.op !== 'SETOP_NONE' ? [...arms(q.larg), ...arms(q.rarg)] : [q])
      arms(x.subselect?.SelectStmt).forEach((q) => visit(null, q?.targetList))
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

// The SECURITY DEFINER functions of a feat or a graft that return rows
// and are not declared, or whose declaration their query does not keep
// (architecture.md, "Reading"). Such a function reads as its owner, past
// every policy, so it is declared in its comment:
//   'audience: shared by <columns>: why', or 'audience: shared: why'
//     it sums, showing outside a sum no column that says whose a row is
//     nor a personal one, grouped by none, each column it names one it
//     returns or takes; or it filters, each arm of its query keeping in
//     its WHERE a test of a known pattern (`pattern`, as a definer);
//   'audience: keyed by <argument>: why'
//     it matches its rows by that argument's digest, a secret its caller
//     holds, as an invitation's link does.
export function definers(found) {
  const out = []
  const personal = (c) => found.personal?.includes(c) || found.carried?.has(c)
  for (const f of found.functions?.values() ?? []) {
    if (!f.definer || !f.rows) {
      continue
    }
    const m = (f.comment ?? '').match(/^audience: (shared|keyed)(?: by ([^:]+))?: \S/)
    if (!m) {
      out.push(`${f.path}: ${f.name} runs as its owner and returns rows, past every policy: make it SECURITY INVOKER, or comment it 'audience: shared by <columns>: why' or 'audience: keyed by <argument>: why' (architecture.md, "Reading")`)
      continue
    }
    const [, kind, by] = m
    const named = (by ?? '').split(',').map((c) => c.trim()).filter(Boolean)
    let tree = null
    try {
      tree = typeof f.body === 'string' && f.lang === 'sql' ? found.parse(f.body) : f.lang === 'sql' ? f.body : null
    } catch {
      tree = null
    }
    const query = [...(tree?.stmts ?? [])].reverse().find((x) => x.stmt.SelectStmt)?.stmt.SelectStmt
    if (!query) {
      out.push(`${f.path}: ${f.name} is declared ${kind}, but returns no query the check reads: write it LANGUAGE sql`)
      continue
    }
    const arms = (q) => (q?.op && q.op !== 'SETOP_NONE' ? [...arms(q.larg), ...arms(q.rarg)] : [q])
    const conjuncts = (q) => (q.whereClause?.BoolExpr?.boolop === 'AND_EXPR' ? q.whereClause.BoolExpr.args : q.whereClause ? [q.whereClause] : [])
    if (kind === 'keyed') {
      const key = named.length === 1 && f.takes.includes(named[0]) ? named[0] : null
      const digest = (n) => {
        const c = n?.FuncCall
        return c && ['sha256', 'digest'].includes(strings(c.funcname).at(-1)) && strings(c.args?.[0]?.ColumnRef?.fields).at(-1) === key
      }
      const matched = (q) => conjuncts(q).some((t) => t.A_Expr?.kind === 'AEXPR_OP' && strings(t.A_Expr.name).join() === '=' && (digest(t.A_Expr.lexpr) || digest(t.A_Expr.rexpr)))
      if (!key) {
        out.push(`${f.path}: ${f.name} is declared keyed by ${by ?? 'nothing'}, which is not one argument it takes`)
      } else if (!arms(query).every(matched)) {
        out.push(`${f.path}: ${f.name} is declared keyed by ${key}, but matches its rows by no digest of it: compare a column with sha256(${key})`)
      }
      continue
    }
    for (const c of named.filter((c) => !f.returns.includes(c) && !f.takes.includes(c))) {
      out.push(`${f.path}: ${f.name} is declared shared by ${c}, which it neither returns nor takes`)
    }
    if (arms(query).every((q) => conjuncts(q).some((t) => pattern(t, f.scope, found, true)))) {
      continue
    }
    const tables = new Map()
    walk(query, (key, n) => {
      if (key === 'RangeVar' && n.schemaname) {
        tables.set(n.alias?.aliasname ?? n.relname, `${n.schemaname}.${n.relname}`)
      }
    })
    const resolve = (ref) => {
      const p = strings(ref.fields)
      const t = p.length >= 2 ? tables.get(p.at(-2)) : null
      return t ? [`${t}.${p.at(-1)}`] : p.length === 1 ? [...new Set(tables.values())].map((x) => `${x}.${p[0]}`) : []
    }
    for (const q of arms(query)) {
      const whose = [
        ...(q.targetList ?? []).flatMap((t) => shown(t.ResTarget.val)),
        ...(q.groupClause ?? []).flatMap((g) => refs(g)),
      ].flatMap(resolve).find((c) => found.readers?.has(c) || personal(c))
      if (whose) {
        out.push(`${f.path}: ${f.name} is declared shared, but shows ${whose}, which says whose a row is or is personal, outside a sum: sum it, or keep only the rows its reader reads by a test of a known pattern in its WHERE, (SELECT circle.whole()) for cella.sees (architecture.md, "Reading")`)
        break
      }
    }
  }
  return out
}

// Whether a view's options make it read as its reader: WITH
// (security_invoker = true), or the option bare.
function invoker(options) {
  const arg = (options ?? []).find((d) => d.DefElem?.defname === 'security_invoker')?.DefElem.arg
  if (!(options ?? []).some((d) => d.DefElem?.defname === 'security_invoker')) {
    return false
  }
  const v = arg?.Boolean?.boolval ?? arg?.String?.sval ?? arg?.Integer?.ival ?? arg?.A_Const?.boolval?.boolval ?? true
  return v === true || v === 1 || ['true', 'on', 'yes', '1'].includes(String(v).toLowerCase())
}

// The views of a feat's or a graft's migrations that read as their owner,
// past every row-level policy, and are not declared shared, or whose
// declaration their query does not keep (architecture.md, "SQL"). A view
// reads as its reader, WITH (security_invoker = true), unless its comment
// declares it shared, 'audience: shared by <columns>: why' or 'audience:
// shared: why', and then each arm of its query keeps its rows by its
// reader's test in its WHERE (`pattern`), a share that needs the whole to
// divide; or it sums, by exactly the columns it names and no finer, or
// shows the rows of a view that sums so, as a contract's shared view
// does (`shared`), and shows outside a sum, and groups by, no column that
// says whose a row is nor a personal one. Whether its grouping is a
// record's own key, so that each sum is one record's, the check cannot
// see: such a view reads as its reader, and review reads it.
export function unshared(found) {
  const out = []
  const personal = (c) => found.personal?.includes(c) || found.carried?.has(c)
  const conjuncts = (q) => (q.whereClause?.BoolExpr?.boolop === 'AND_EXPR' ? q.whereClause.BoolExpr.args : q.whereClause ? [q.whereClause] : [])
  for (const v of found.views?.values() ?? []) {
    if (v.invoker) {
      continue
    }
    const aud = /^audience: shared(?: by [^:]+)?: \S/.test(v.comment ?? '') ? audience(v.comment) : null
    if (!aud || aud.scoped) {
      out.push(`${v.path}: ${v.name} reads as its owner, past every row-level policy: make it WITH (security_invoker = true), or comment it 'audience: shared by <columns>: why' where it sums the whole (architecture.md, "SQL")`)
      continue
    }
    const fail = (msg) => out.push(`${v.path}: ${msg}`)
    const { view, names, selects, resolve } = shape(v.stmt)
    for (const c of aud.by.filter((c) => !names.includes(c))) {
      fail(`${view} names ${c} in its audience, which it does not show`)
    }
    if (selects.every((q) => conjuncts(q).some((t) => pattern(t, v.scope, found)))) {
      continue
    }
    shared(view, aud, names, selects, resolve, fail, found)
    for (const q of selects) {
      const whose = [
        ...(q.targetList ?? []).flatMap((t) => refs(t.ResTarget.val, true)),
        ...(q.groupClause ?? []).flatMap((g) => refs(g)),
      ].flatMap(resolve).find((c) => found.readers?.has(c) || personal(c))
      if (whose) {
        fail(`${view} is declared shared, but shows or groups by ${whose}, which says whose a row is or is personal: sum over everyone, keep only the rows its reader reads by a test of a known pattern in its WHERE, or make it WITH (security_invoker = true)`)
        break
      }
    }
  }
  return out
}

// The motion feat's register of the ops that cite a motion, whose
// rows mark an op as carried by a motion, with the power a collective
// mandate of its circle grants it: the grafts that judge a cited write
// attach their guards to every op listed.
const cites = { schema: 'motion', table: 'cites' }

// The motion feat's register of the power a stance needs, which a
// motion's procedure gives the seats on its roll, and no mandate.
const stancePower = { schema: 'motion', table: 'stance_power' }

function citing(b, o, found, into = found.cites) {
  const cols = (b.cols ?? []).map((c) => c.ResTarget.name)
  for (const row of b.selectStmt?.SelectStmt?.valuesLists ?? []) {
    const vals = Object.fromEntries(row.List.items.map((v, i) => [cols[i], v.A_Const?.sval?.sval]))
    if (vals.op) {
      into.push({ op: vals.op, power: vals.power ?? null, owner: o.name })
    }
  }
}

// The motion feat's register functions, by how many arguments each takes:
// a graft registers what it brings by calling them, never by inserting
// the row (architecture.md, "Writes stay home"). Each call's arguments are
// literals, the last its caller's own name, so the check reads the action
// a call lists in motion.cites, and its power, as it reads a literal row.
const registerFns = { 'motion.register_carries': 5, 'motion.register_cite': 3, 'motion.register_cite_guard': 2, 'motion.register_put': 2, 'motion.register_ask_guard': 2 }

function registersBy(call, o, fail, found) {
  const f = strings(call.funcname).join('.')
  if (f === 'cella.lets_follow') {
    follows(call, o, fail, found)
    return
  }
  if (!registerFns[f]) {
    return
  }
  const args = (call.args ?? []).map((a) => a.A_Const?.sval?.sval)
  if (args.length !== registerFns[f] || args.includes(undefined)) {
    fail(`calls ${f} with an argument that is no literal string, which the check cannot see`)
    return
  }
  if (args.at(-1) !== o.name) {
    fail(`registers by ${f} as ${args.at(-1)}, not as itself, ${o.name}`)
  }
  if (f === 'motion.register_cite') {
    found.cites.push({ op: args[0], power: args[1], owner: o.name })
  }
}

// `cella.lets_follow(cause, op, owner[, required])`: which op a slice's
// reaction writes as an effect of which, registered under its own name,
// each argument a literal, so feat-check sees every `on` registered.
function follows(call, o, fail, found) {
  const args = call.args ?? []
  const [cause, op, owner] = args.slice(0, 3).map((a) => a.A_Const?.sval?.sval)
  const required = args[3]?.A_Const?.boolval
  if (args.length < 3 || args.length > 4 || [cause, op, owner].includes(undefined) || (args.length === 4 && !required)) {
    fail('calls cella.lets_follow with an argument that is no literal, which the check cannot see')
    return
  }
  if (owner !== o.name) {
    fail(`registers by cella.lets_follow as ${owner}, not as itself, ${o.name}`)
  }
  found.follows.push({ cause, op, owner: o.name, required: required?.boolval === true })
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
        // A partition is its parent's: the parent names its circle.
        if (!b.partbound) {
          const key = named(b.relation)
          ;(found.tables ??= []).push({ key, path: found.at, owned: owning(b.tableElts) })
          // A table that names its owning circle is under core's
          // row-level policy: its rows are a circle's records.
          if (owning(b.tableElts)) {
            found.owned.add(key)
            found.circles.add(`${key}.circle`)
          }
        }
      }
      walk(b, (_, n) => {
        const into = n.Constraint?.pktable
        if (n.Constraint?.contype === 'CONSTR_FOREIGN' && into?.schemaname !== b.relation.schemaname && !circleTable(into)) {
          fail(`${named(b.relation)} holds a foreign key into ${named(n.Constraint.pktable)}: no foreign key crosses a feat`)
        }
      })
      break
    case 'CreateSeqStmt':
      owned(b.sequence.schemaname, `creates ${named(b.sequence)}`)
      break
    case 'ViewStmt': {
      owned(b.view.schemaname, `creates ${named(b.view)}`)
      ;(found.composites ??= new Set()).add(named(b.view))
      // A view over a table under row-level security hides it: it is
      // secured in turn, for a contract that reads it.
      if (read(b.query).some((t) => found.secured.has(t))) {
        found.secured.add(named(b.view))
      }
      // So is a view over a circle's records, and a view that sums keeps
      // its grain, for a shared view that shows its rows.
      if (read(b.query).some((t) => found.owned.has(t))) {
        found.owned.add(named(b.view))
      }
      const { names, selects } = shape(b)
      const grains = selects.map((q) => grouping(q, names))
      if (grains.every((g) => g.sums && !g.loose.length)) {
        found.summed.set(named(b.view), new Set(grains.flatMap((g) => g.keys)))
      }
      carry(b, found)
      // A view a slice's migrations make, beside its contract: whether it
      // reads as its reader, and its comment, which outlives a CREATE OR
      // REPLACE as the view does; the replacement's options are its own.
      if (o.kind !== 'core' && !found.at.endsWith(`/${CONTRACT}`)) {
        const view = named(b.view)
        ;(found.views ??= new Map()).set(view, { name: view, path: found.at, scope: s, stmt: b, invoker: invoker(b.options), comment: found.views.get(view)?.comment ?? null })
      }
      break
    }
    case 'IndexStmt':
    case 'AlterTableStmt':
      owned(b.relation.schemaname, `${type === 'IndexStmt' ? 'indexes' : 'alters'} ${named(b.relation)}`)
      if (type === 'AlterTableStmt' && (b.cmds ?? []).some((c) => c.AlterTableCmd?.subtype === 'AT_EnableRowSecurity')) {
        found.secured.add(named(b.relation))
      }
      if (type === 'AlterTableStmt' && o.kind !== 'core') {
        for (const c of (b.cmds ?? []).map((x) => x.AlterTableCmd?.subtype).filter((x) => ['AT_DisableRowSecurity', 'AT_NoForceRowSecurity'].includes(x))) {
          fail(`${c === 'AT_DisableRowSecurity' ? 'disables' : 'unforces'} row-level security on ${named(b.relation)}: every table a slice makes is under it, forced, as core's circles make it`)
        }
      }
      if (type === 'AlterTableStmt' && found.views?.has(named(b.relation))) {
        const v = found.views.get(named(b.relation))
        for (const c of (b.cmds ?? []).map((x) => x.AlterTableCmd)) {
          const options = (c?.def?.List?.items ?? []).filter((d) => d.DefElem?.defname === 'security_invoker')
          if (c?.subtype === 'AT_SetRelOptions' && options.length) {
            v.invoker = invoker(options)
          }
          if (c?.subtype === 'AT_ResetRelOptions' && options.length) {
            v.invoker = false
          }
        }
      }
      if (type === 'AlterTableStmt' && o.kind !== 'core') {
        const added = (b.cmds ?? []).map((c) => c.AlterTableCmd).filter((c) => c?.subtype === 'AT_AddColumn').map((c) => c.def)
        columns(b.relation, added, found.at, found)
      }
      break
    case 'CommentStmt':
      if (b.objtype === 'OBJECT_TABLE' && /^registry: ./.test(b.comment ?? '')) {
        const parts = strings(b.object?.List?.items)
        owned(parts[0], `comments on ${parts.join('.')}`)
        ;(found.registries ??= new Set()).add(parts.join('.'))
      }
      if (b.objtype === 'OBJECT_POLICY' && /^shared: ./.test(b.comment ?? '')) {
        const parts = strings(b.object?.List?.items)
        owned(parts[0], `comments on the policy ${parts[2]} on ${parts.slice(0, 2).join('.')}`)
        const p = found.policies?.get(parts.slice(0, 2).join('.'))?.get(parts[2])
        if (p) {
          p.shared = true
        }
      }
      if (b.objtype === 'OBJECT_VIEW' && found.views?.has(strings(b.object?.List?.items).join('.'))) {
        found.views.get(strings(b.object.List.items).join('.')).comment = b.comment ?? null
      }
      if (b.objtype === 'OBJECT_FUNCTION') {
        const fn = found.functions?.get(strings(b.object?.ObjectWithArgs?.objname).join('.'))
        if (fn) {
          fn.comment = b.comment ?? null
        }
      }
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
      if (o.kind !== 'core') {
        made(b, f.join('.'), s, found)
      }
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
      if (o.kind !== 'core') {
        policy(b, s, found)
      }
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
    case 'AlterPolicyStmt':
      owned(b.table.schemaname, `alters the policy ${b.policy_name} on ${named(b.table)}`)
      if (o.kind !== 'core' && b.qual) {
        const p = found.policies?.get(named(b.table))?.get(b.policy_name)
        if (p) {
          p.known = pattern(b.qual, s, found)
        }
      }
      break
    case 'AlterFunctionStmt': {
      const f = strings(b.func?.objname)
      owned(f.length > 1 ? f[0] : null, `alters ${f.join('.')}`)
      for (const a of b.actions ?? []) {
        const fn = found.functions?.get(f.join('.'))
        if (a.DefElem.defname === 'security' && fn) {
          fn.definer = a.DefElem.arg?.Boolean?.boolval === true
        }
        const set = a.DefElem.defname === 'set' ? a.DefElem.arg.VariableSetStmt : null
        if (set?.name === 'search_path' && (set.args ?? []).some((v) => !catalog.has(v.A_Const?.sval?.sval))) {
          fail(`${f.join('.')} sets search_path beyond the catalog: only the catalog, and every name qualified`)
        }
      }
      break
    }
    case 'CompositeTypeStmt':
      owned(b.typevar.schemaname, `creates the type ${named(b.typevar)}`)
      ;(found.composites ??= new Set()).add(named(b.typevar))
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
        if (b.removeType === 'OBJECT_FUNCTION') {
          found.functions?.delete(parts.join('.'))
        }
        if (b.removeType === 'OBJECT_POLICY' && o.kind !== 'core') {
          const table = parts.slice(0, 2).join('.')
          found.policies?.get(table)?.delete(parts[2])
          if (parts[2] === 'circle') {
            ;(found.uncircled ??= new Set()).add(table)
          }
        }
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
      if (b.relation.schemaname === stancePower.schema && b.relation.relname === stancePower.table) {
        citing(b, o, found, (found.stances ??= []))
      }
    // falls through
    case 'UpdateStmt':
    case 'DeleteStmt':
      if (b.relation.schemaname === 'cella' && o.kind === 'core' && type === 'InsertStmt' && o.lib) {
        collects(b, o.lib, found)
      } else if (b.relation.schemaname === 'cella' && o.kind !== 'core') {
        if (type !== 'InsertStmt' || !registries.has(b.relation.relname)) {
          fail(`writes ${named(b.relation)}: a ${o.kind} writes cella.* only to register its guards, its powers, its personal columns, the keyring or who reads`)
        } else if (b.relation.relname === 'keyring' && o.kind !== 'feat') {
          fail(`registers the keyring: only a feat resolves device keys, not ${o.kind} ${o.name}`)
        } else if (b.relation.relname === 'reach' && o.kind !== 'graft') {
          fail(`registers cella.reach: only a graft opens a feat's rows to more readers, not ${o.kind} ${o.name}`)
        } else {
          registers(b, o, s, fail, found)
        }
      }
      break
  }
}

// What a core library registers, under its own name: the powers its ops
// need and the guards on them, for feat-check to compare with its
// actions.ts as it does a slice's.
function collects(b, lib, found) {
  const cols = (b.cols ?? []).map((c) => c.ResTarget.name)
  const literal = (v) => (v.A_Const?.isnull ? null : v.A_Const?.sval?.sval)
  for (const row of b.selectStmt?.SelectStmt?.valuesLists ?? []) {
    const vals = Object.fromEntries(row.List.items.map((v, i) => [cols[i], literal(v)]))
    if (b.relation.relname === 'power' && vals.op) {
      found.powers.push({ op: vals.op, power: vals.power ?? null, amount: vals.amount ?? null, owner: lib })
    }
    if (b.relation.relname === 'guard' && vals.op) {
      found.guards.push({ op: vals.op, owner: lib })
    }
  }
}

// A registration under its owner's name: a guard on an op of a feat it may
// see; a power only on an op of its own. Literal power rows are collected
// for feat-check to compare with actions.ts.
function registers(b, o, s, fail, found) {
  const what = b.relation.relname
  const cols = (b.cols ?? []).map((c) => c.ResTarget.name)
  const literal = (v) => (v.A_Const?.isnull ? null : v.A_Const?.sval?.sval)
  for (const row of b.selectStmt?.SelectStmt?.valuesLists ?? []) {
    const vals = Object.fromEntries(row.List.items.map((v, i) => [cols[i], literal(v)]))
    const feat = vals.op?.split(':')[0]
    if (what === 'guard' && vals.op && !s.ops.includes(feat)) {
      fail(`registers a guard on ${vals.op}, an op of ${feat}, which ${o.name} neither joins nor builds on`)
    }
    if (what === 'power' && feat !== o.name) {
      fail(`registers a power on ${vals.op}, an op of ${feat}: only ${feat} names what its ops need`)
    }
    if (vals.owner !== undefined && vals.owner !== o.name) {
      fail(`registers a ${what} as ${vals.owner}, not as itself, ${o.name}`)
    }
    if (what === 'guard' && vals.op) {
      found.guards.push({ op: vals.op, owner: o.name })
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
    fail('registers powers from a query: a power is a literal row, so feat-check can compare it with actions.ts')
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
      if (t.ResTarget.val?.ColumnRef && cols.some((c) => found.circles.has(c))) {
        found.circles.add(`${view}.${names[i]}`)
      }
    })
  }
}

// A column reference or an expression as the parser reads it, wherever
// it stands in the text.
const bare = (n) => JSON.stringify(n, (k, x) => (k === 'location' ? undefined : x))

// Whether a select sums its rows, and by what: the names of the columns
// that show its GROUP BY keys, and the keys it shows no column of.
function grouping(q, names) {
  const targets = (q.targetList ?? []).map((t) => bare(t.ResTarget.val))
  const keys = []
  const loose = []
  for (const g of q.groupClause ?? []) {
    const f = strings(g.ColumnRef?.fields)
    let i = targets.indexOf(bare(g))
    if (i < 0 && f.length === 1) {
      i = names.indexOf(f[0])
    }
    if (i < 0) {
      loose.push(g)
    } else {
      keys.push(names[i])
    }
  }
  const sums = (q.groupClause ?? []).length > 0 || (q.targetList ?? []).some((t) => summing(t.ResTarget.val))
  return { sums, keys, loose }
}

// Whether an expression sums the rows of its own select: an aggregate
// outside any subquery in it.
function summing(n) {
  let hit = false
  const visit = (key, x) => {
    if (hit || key === 'SubLink') {
      return
    }
    if (key === 'FuncCall' && aggregate(x)) {
      hit = true
    } else if (Array.isArray(x)) {
      x.forEach((y) => visit(key, y))
    } else if (x && typeof x === 'object') {
      for (const [k, y] of Object.entries(x)) {
        visit(k, y)
      }
    }
  }
  visit(null, n)
  return hit
}

// A view's audience, from its comment: scoped by its circle column and
// the column that says whose a row is, or shared by the columns it sums by.
const AUDIENCE = /^audience: (scoped|shared)(?: by ([a-z_][a-z0-9_]*(?:(?:, | and )[a-z_][a-z0-9_]*)*))?(?=$|[.;:] )/
function audience(comment) {
  const m = AUDIENCE.exec(comment ?? '')
  if (!m) {
    return null
  }
  const by = m[2] ? m[2].split(/, | and /) : []
  return m[1] === 'scoped' ? { scoped: true, by, circle: by[0], whose: by[1], extra: by.slice(2) } : { scoped: false, by }
}

function contract(tree, o, fail, found) {
  if (o.kind === 'core') {
    if (!PORT.test(o.dir) && o.lib !== CIRCLES) {
      fail('an analytical contract is a feat\'s or a graft\'s, never a core\'s but the analytics port\'s and the circles\'')
      return
    }
    const own = PORT.test(o.dir) ? 'analytics' : CIRCLES
    for (const { stmt } of tree.stmts ?? []) {
      if (stmt.ViewStmt && stmt.ViewStmt.view?.schemaname !== own) {
        fail(`${stmt.ViewStmt.view?.relname}: a core library publishes only in its own schema, ${own}`)
      }
    }
  }
  // The view columns the contract declares, personal or not, and each
  // view's audience.
  const declared = new Set()
  const audiences = new Map()
  for (const { stmt } of tree.stmts ?? []) {
    const [type, b] = Object.entries(stmt)[0]
    if (type === 'CommentStmt' && ['OBJECT_COLUMN', 'OBJECT_VIEW'].includes(b.objtype)) {
      if (b.objtype === 'OBJECT_COLUMN' && /^(not )?personal: ./.test(b.comment ?? '')) {
        declared.add(strings(b.object?.List?.items).join('.'))
      }
      if (b.objtype === 'OBJECT_VIEW') {
        audiences.set(strings(b.object?.List?.items).join('.'), audience(b.comment))
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
    const aud = audiences.get(view)
    if (!aud) {
      fail(`${view} declares no audience: comment it 'audience: scoped by <circle column>' or 'audience: shared by <columns>'`)
    } else {
      for (const c of aud.by.filter((c) => !names.includes(c))) {
        fail(`${view} names ${c} in its audience, which it does not show`)
      }
      if (aud.scoped) {
        scoped(view, aud, names, selects, resolve, fail, found)
      } else {
        shared(view, aud, names, selects, resolve, fail, found)
      }
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
      const { sums } = grouping(q, names)
      // The rows a policy opens by their circle alone, kept by `col IS
      // NULL` in the view's own test.
      const kept = new Set()
      const tests = q.whereClause?.BoolExpr?.boolop === 'AND_EXPR' ? q.whereClause.BoolExpr.args : [q.whereClause]
      for (const t of tests) {
        if (t?.NullTest?.nulltesttype === 'IS_NULL' && t.NullTest.arg?.ColumnRef) {
          resolve(t.NullTest.arg.ColumnRef).filter((c) => found.open.has(c)).forEach((c) => kept.add(c.split('.').slice(0, 2).join('.')))
        }
      }
      const shut = secured.filter((t) => !kept.has(t))
      if (!sums && shut.length) {
        fail(`${view} shows the rows of ${shut[0]}, which is under row-level security: a contract shows its rows only as sums, or those its policy opens by their circle alone, kept by 'col IS NULL'`)
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

// A scoped view shows one row per record, each with the circle that owns
// it, and names the column that says whose a row is wherever it shows one.
function scoped(view, aud, names, selects, resolve, fail, found) {
  if (aud.extra.length) {
    fail(`${view} names ${aud.extra.join(', ')} past its circle and whose: 'audience: scoped by <circle> and <whose>'`)
  }
  const says = (t) => refs(t.ResTarget.val, true).flatMap(resolve).some((c) => found.readers.has(c))
  for (const q of selects) {
    if (grouping(q, names).sums) {
      fail(`${view} is scoped and sums: a scoped view shows one row per record, and a sum is shared`)
    }
    const circle = q.targetList?.[names.indexOf(aud.circle)]?.ResTarget.val?.ColumnRef
    if (names.includes(aud.circle) && !(circle && resolve(circle).some((c) => found.circles.has(c)))) {
      fail(`${view}.${aud.circle} is no record's owning circle: a scoped view shows the circle column of the records it shows`)
    }
    q.targetList?.forEach((t, i) => {
      if (names[i] === aud.whose) {
        if (!says(t)) {
          fail(`${view}.${names[i]} does not say whose a row is: no row-level policy opens its rows by it`)
        }
      } else if (says(t)) {
        fail(`${view}.${names[i]} says whose a row is: name it, 'audience: scoped by ${aud.circle} and ${names[i]}'`)
      }
    })
  }
}

// A shared view sums by exactly the columns it names, at its top level or
// in a view whose rows it shows, and shows no row of a circle's records.
function shared(view, aud, names, selects, resolve, fail, found) {
  for (const q of selects) {
    const g = grouping(q, names)
    if (g.sums) {
      for (const k of g.loose) {
        fail(`${view} groups by ${strings(k.ColumnRef?.fields).join('.') || 'an expression'}, which it does not show: a shared view groups by the columns it names, and no finer`)
      }
      for (const k of g.keys.filter((k) => !aud.by.includes(k))) {
        fail(`${view} groups by ${k}, which its audience does not name: 'audience: shared by ${g.keys.join(', ')}'`)
      }
      for (const n of aud.by.filter((n) => names.includes(n) && !g.keys.includes(n))) {
        fail(`${view} names ${n} in its audience and does not group by it`)
      }
      continue
    }
    for (const t of new Set(read(q).filter((t) => found.owned.has(t)))) {
      const grain = found.summed.get(t)
      if (!grain) {
        fail(`${view} shows the rows of ${t}, which are a circle's records: declare it 'audience: scoped by <circle column>', or sum them`)
        continue
      }
      for (const k of grain) {
        const i = (q.targetList ?? []).findIndex((x) => x.ResTarget.val?.ColumnRef && resolve(x.ResTarget.val.ColumnRef).includes(`${t}.${k}`))
        if (i < 0 || !aud.by.includes(names[i])) {
          fail(`${view} shows ${t}, which sums by ${k}: show it and name it, 'audience: shared by <columns>'`)
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
// compare with each op's label: the powers in cella.power, the guards in
// cella.guard, the ops that cite a motion in motion.cites, and the power a
// stance needs in motion.stance_power.
export async function checkSql(repo, apps, known, found = { powers: [], guards: [], cites: [], stances: [], personal: [], impersonal: [], columns: [], foreign: [] }) {
  const lib = await import('libpg-query')
  await lib.loadModule?.()
  found.parse = lib.parseSync
  const errors = []
  found.foreign ??= []
  found.secured ??= new Set()
  found.readers ??= new Set()
  found.open ??= new Set()
  found.carried ??= new Set()
  found.follows ??= []
  found.owned ??= new Set()
  found.circles ??= new Set()
  found.summed ??= new Map()
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
