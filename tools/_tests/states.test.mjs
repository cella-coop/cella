// The feat check's status rule: the lifecycle a slice's models/status.ts
// declares lists the values the CHECK on its column does, no more and no
// fewer, each once and in a category the UI kit knows.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { agreeStates, lifecycles } from '../states.mjs'
import { checkSql } from '../sql-check.mjs'

const file = 'apps/org/feats/task/core/ts/src/models/status.ts'
const declared = (states, column = 'task.status') => ({ name: 'status', schema: 'task', file, line: 7, column, states })
const check = (values) => ({ key: 'task.task.status', values, path: 'apps/org/feats/task/core/sql/001-task.sql', line: 15 })
const task = [
  { value: 'backlog', category: 'backlog' },
  { value: 'next', category: 'unstarted' },
  { value: 'done', category: 'completed' },
]

test('a lifecycle listing what its CHECK lists agrees, in any order', () => {
  assert.deepEqual(agreeStates([declared(task)], [check(['next', 'done', 'backlog'])]), [])
})

test('a state the CHECK refuses, or one it allows and the lifecycle leaves out, is refused by file and line', () => {
  const [extra] = agreeStates([declared([...task, { value: 'gone', category: 'cancelled' }])], [check(['backlog', 'next', 'done'])])
  assert.equal(extra, `${file}:7: status declares gone, which the CHECK on task.task.status at apps/org/feats/task/core/sql/001-task.sql:15 refuses; add it there or drop it here`)
  const [missing] = agreeStates([declared(task.slice(1))], [check(['backlog', 'next', 'done'])])
  assert.match(missing, /status\.ts:7: status leaves out backlog, which the CHECK on task\.task\.status at .*001-task\.sql:15 allows/)
})

test('a lifecycle whose column no CHECK lists is refused', () => {
  assert.match(agreeStates([declared(task)], [])[0], /declares task\.task\.status's states, but no CHECK of task's SQL lists that column's values/)
  assert.match(agreeStates([declared(task, 'status')], [check(['backlog'])])[0], /'s column is status; it names <table>\.<column> in the slice's own schema, task/)
})

test('a state declared twice, a category the kit does not know, or a column declared twice is refused', () => {
  const twice = agreeStates([declared([...task, { value: 'next', category: 'unstarted' }])], [check(['backlog', 'next', 'done'])])
  assert.match(twice[0], /declares the state next twice/)
  const odd = agreeStates([declared([...task.slice(0, 2), { value: 'done', category: 'finished' }])], [check(['backlog', 'next', 'done'])])
  assert.match(odd[0], /state done is in the category finished, which is none of backlog, unstarted, started, completed, cancelled/)
  const again = agreeStates([declared(task), declared(task)], [check(['backlog', 'next', 'done'])])
  assert.match(again[0], /declares task\.task\.status's states again/)
})

test("sql-check collects each CHECK listing a column's values, on the column or the table, with its line", async () => {
  const repo = mkdtempSync(join(tmpdir(), 'cella-states-'))
  try {
    mkdirSync(join(repo, 'apps/org/feats/task/core/sql'), { recursive: true })
    writeFileSync(join(repo, 'apps/org/feat.toml'), 'name = "org"\n')
    writeFileSync(join(repo, 'apps/org/feats/task/feat.toml'), 'name = "task"\n')
    writeFileSync(
      join(repo, 'apps/org/feats/task/core/sql/001.sql'),
      [
        'CREATE SCHEMA task;',
        'CREATE TABLE task.task (',
        '  id text PRIMARY KEY,',
        "  status text NOT NULL DEFAULT 'next' CHECK (status IN ('backlog', 'next', 'done')),",
        '  kind text NOT NULL,',
        "  CHECK (kind IN ('chore', 'bug'))",
        ');',
        '',
      ].join('\n'),
    )
    const found = { powers: [], guards: [], cites: [], stances: [], personal: [], impersonal: [], columns: [] }
    await checkSql(repo, ['apps/org'], new Set(['cella', 'task']), found)
    assert.deepEqual(
      found.listed.map(({ key, values, line }) => ({ key, values, line })),
      [
        { key: 'task.task.status', values: ['backlog', 'next', 'done'], line: 4 },
        { key: 'task.task.kind', values: ['chore', 'bug'], line: 6 },
      ],
    )
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test("lifecycles reads every lifecycle a slice's models/status.ts exports, with its line", async () => {
  const repo = mkdtempSync(join(tmpdir(), 'cella-states-'))
  try {
    const dir = 'apps/org/feats/task/core/ts'
    mkdirSync(join(repo, dir, 'src/models'), { recursive: true })
    writeFileSync(
      join(repo, dir, 'src/models/status.ts'),
      ['// A task.', 'export const status = {', "  column: 'task.status',", "  states: [{ value: 'next', category: 'unstarted' }],", '}', 'export const other = 3', ''].join('\n'),
    )
    const [l, ...rest] = await lifecycles(repo, [{ dir, schema: 'task' }])
    assert.deepEqual(rest, [])
    assert.deepEqual({ ...l, file: undefined }, { name: 'status', schema: 'task', file: undefined, line: 3, column: 'task.status', states: [{ value: 'next', category: 'unstarted' }] })
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})
