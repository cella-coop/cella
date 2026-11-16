// demo: the demo's template and its copies, on the cluster DATABASE_URL
// names, whose database is the template's (`cella demo`).
//
//   renew                       drops the template if it is there and creates it
//                               empty, for `cella demo template` to migrate and seed
//   label                       prints what built the template, nothing where it is none
//   close --made-by TEXT        marks it a template, closes it to every connection
//                               and labels it with what made it
//   copy NAME [--replace]       makes NAME from it by CREATE DATABASE … TEMPLATE,
//                               with the settings the template's database and roles
//                               carry there, which a copy does not take by itself
//
// It connects as DATABASE_URL's role, a superuser, to the cluster's
// `postgres` database, since none of this runs in the database it makes.

import pg from 'pg'
import { parts } from './seed/url.mjs'

const url = process.env.DATABASE_URL
if (!url) {
  throw new Error('demo: DATABASE_URL names the template')
}
const at = parts(url)
const template = at.database
if (!template) {
  throw new Error('demo: DATABASE_URL names no database')
}

const [verb, ...rest] = process.argv.slice(2)
const flag = (name) => {
  const i = rest.indexOf(name)
  return i < 0 ? undefined : (rest[i + 1] ?? '')
}

const db = new pg.Client({ ...at, database: 'postgres' })
await db.connect()
const id = (name) => db.escapeIdentifier(name)
const exists = async (name) => (await db.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])).rowCount > 0
// What a template's comment opens with, from its making on.
const TEMPLATE = 'cella demo template: '
// Refuses to drop a database that is not what its comment must say it is,
// a demo's template or a copy of it, so no co-op's database is ever
// dropped for a demo's.
const refuse = async (name, marker, what) => {
  const made = (await db.query("SELECT coalesce(shobj_description(oid, 'pg_database'), '') AS made FROM pg_database WHERE datname = $1", [name])).rows[0]?.made ?? ''
  if (!made.startsWith(marker)) {
    throw new Error(`demo: ${name} is not ${what}, as its comment would say, so it is never dropped for a demo's; name a database of the demo's own`)
  }
}

try {
  if (verb === 'renew') {
    if (await exists(template)) {
      await refuse(template, TEMPLATE, 'a template cella demo template built')
      await db.query(`ALTER DATABASE ${id(template)} WITH IS_TEMPLATE false`)
      await db.query(`DROP DATABASE ${id(template)} WITH (FORCE)`)
    }
    await db.query(`CREATE DATABASE ${id(template)}`)
    // Marked at once, so a build cut off is a template's to renew still.
    await db.query(`COMMENT ON DATABASE ${id(template)} IS ${db.escapeLiteral(`${TEMPLATE}building`)}`)
    console.log(`demo: ${template} made afresh`)
  } else if (verb === 'label') {
    const row = (await db.query("SELECT coalesce(shobj_description(oid, 'pg_database'), '') AS made, datistemplate FROM pg_database WHERE datname = $1", [template])).rows[0]
    console.log(row?.datistemplate ? row.made : '')
  } else if (verb === 'close') {
    const made = flag('--made-by')
    if (!made) {
      throw new Error('demo close: --made-by says what built the template')
    }
    await db.query(`ALTER DATABASE ${id(template)} WITH IS_TEMPLATE true ALLOW_CONNECTIONS false`)
    await db.query(`COMMENT ON DATABASE ${id(template)} IS ${db.escapeLiteral(made)}`)
    // A connection the seed left open would keep a copy from being made.
    await db.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1', [template])
    console.log(`demo: ${template} closed, a template`)
  } else if (verb === 'copy') {
    const name = rest.find((a) => !a.startsWith('--'))
    if (!name) {
      throw new Error('demo copy: name the database to make')
    }
    if (name === template) {
      throw new Error(`demo copy: ${name} is the template itself`)
    }
    const source = (await db.query("SELECT oid, datistemplate, coalesce(shobj_description(oid, 'pg_database'), '') AS made FROM pg_database WHERE datname = $1", [template])).rows[0]
    if (!source?.datistemplate) {
      throw new Error(`demo copy: ${template} is no template; build it with cella demo template`)
    }
    if (await exists(name)) {
      if (!rest.includes('--replace')) {
        throw new Error(`demo copy: ${name} exists; --replace drops it first`)
      }
      await refuse(name, `a copy of ${template}:`, `a copy of ${template}`)
      await db.query(`DROP DATABASE ${id(name)} WITH (FORCE)`)
    }
    await db.query(`CREATE DATABASE ${id(name)} TEMPLATE ${id(template)}`)
    // Marked at once, so a copy cut off is a copy to replace still.
    await db.query(`COMMENT ON DATABASE ${id(name)} IS ${db.escapeLiteral(`a copy of ${template}: ${source.made}`)}`)
    // What the template's database and its roles there are set to, as the
    // seed set the scope's address, its timezone and the story's clock:
    // pg_db_role_setting is the cluster's, keyed by database, so a copy
    // starts without it.
    const { rows } = await db.query(
      `SELECT r.rolname AS role, s.setconfig AS config
         FROM pg_db_role_setting s LEFT JOIN pg_roles r ON r.oid = s.setrole
        WHERE s.setdatabase = $1`,
      [source.oid],
    )
    for (const { role, config } of rows) {
      for (const setting of config) {
        const eq = setting.indexOf('=')
        const [key, value] = [setting.slice(0, eq), setting.slice(eq + 1)]
        const on = role ? `ROLE ${id(role)} IN DATABASE ${id(name)}` : `DATABASE ${id(name)}`
        await db.query(`ALTER ${on} SET ${key.split('.').map(id).join('.')} = ${db.escapeLiteral(value)}`)
      }
    }
    console.log(`demo: ${name} copied from ${template}`)
  } else {
    throw new Error('demo: renew, close --made-by TEXT, or copy NAME [--replace]')
  }
} finally {
  await db.end()
}
