// The SQL check and the settings: core circle keeps each circle's value
// of a setting in circle.setting_value, and a slice reads a setting by
// circle.setting_of alone; a guard that reads the values' rows is
// refused, as a guard reading a policy's wording is.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkSql } from '../sql-check.mjs'

const circles = `CREATE SCHEMA circle;
CREATE TABLE circle.circle (id text PRIMARY KEY);
CREATE TABLE circle.setting (name text PRIMARY KEY, "default" text NOT NULL);
CREATE TABLE circle.setting_value (id bigint PRIMARY KEY, circle text REFERENCES circle.circle, setting text REFERENCES circle.setting, value text);
CREATE FUNCTION circle.setting_of(circle text, name text) RETURNS text
LANGUAGE sql STABLE
RETURN coalesce((SELECT v.value FROM circle.setting_value v WHERE v.circle = setting_of.circle AND v.setting = setting_of.name),
                (SELECT s."default" FROM circle.setting s WHERE s.name = setting_of.name));`

// Core circle in org's core, and one feat, `chat`, with a guard.
async function check(guard) {
  const repo = mkdtempSync(join(tmpdir(), 'cella-settings-'))
  try {
    const core = join(repo, 'apps/org/core/circle/sql')
    mkdirSync(core, { recursive: true })
    writeFileSync(join(core, '001.sql'), circles)
    const feat = join(repo, 'apps/org/feats/chat/core/sql')
    mkdirSync(feat, { recursive: true })
    writeFileSync(join(repo, 'apps/org/feats/chat/feat.toml'), 'name = "chat"\n')
    writeFileSync(
      join(feat, '001.sql'),
      `CREATE SCHEMA chat;
CREATE TABLE chat.note (id bigint PRIMARY KEY, circle text NOT NULL REFERENCES circle.circle);
${guard}`,
    )
    writeFileSync(join(repo, 'apps/org/feat.toml'), 'name = "org"\n')
    return (await checkSql(repo, ['apps/org'], new Set(['cella', 'circle', 'chat']))).join('\n')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
}

test('core circle reads its own values, and a guard reading a setting by circle.setting_of passes', async () => {
  const errors = await check(`CREATE FUNCTION chat.reacts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE WHEN circle.setting_of(n.circle, 'reactions') = 'off' THEN 'reactions are off in ' || n.circle END
  FROM chat.note n WHERE n.id = (payload ->> 'note')::bigint;
END;`)
  assert.equal(errors, '')
})

test('a guard that reads circle.setting_value is refused', async () => {
  const errors = await check(`CREATE FUNCTION chat.reacts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE WHEN v.value = 'off' THEN 'reactions are off in ' || n.circle END
  FROM chat.note n JOIN circle.setting_value v ON v.circle = n.circle AND v.setting = 'reactions'
  WHERE n.id = (payload ->> 'note')::bigint;
END;`)
  assert.match(errors, /reads circle\.setting_value: a slice reads a setting by circle\.setting_of, never its values' rows/)
})
