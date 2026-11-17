// Every kind a record page shows mounts a body (apps/org/core/body's
// index.md, "Threads"): the feat check refuses a collection whose
// `app/index.ts` declares a `page` but whose slice names no `body` for
// it, but the three kinds whose body is their own, each named exactly
// (document's documents, motion's motions, patronage's statements), and
// passes once the collection's `body` is mounted.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { embodied } from '../powers.mjs'

// A feat's folder, its app a collection of `kind` with a page, its api a
// slice whose collection names no body unless `withBody` is given.
function tree(withBody = false, kind = 'notes') {
  const repo = mkdtempSync(join(tmpdir(), 'embodied-'))
  const at = (p, text) => {
    mkdirSync(dirname(join(repo, p)), { recursive: true })
    writeFileSync(join(repo, p), text)
  }
  const dir = 'apps/org/feats/note/core/ts'
  at(
    `${dir}/src/api/index.ts`,
    `export const slice = {\n  name: 'note',\n  collections: {\n    ${kind}: {\n      item,\n${withBody ? '      body: bodyMount,\n' : ''}      actions: {},\n    },\n  },\n}\n`,
  )
  at(
    `${dir}/src/app/index.ts`,
    `export const app = {\n  name: 'note',\n  collections: {\n    ${kind}: {\n      page: {\n        eyebrow: 'Note',\n        title: (n) => n.title,\n      },\n    },\n  },\n}\n`,
  )
  return { repo, dir }
}

const feat = (dir) => [{ name: 'note', dir }]

test('a collection with a record page but no body is refused by name', () => {
  const { repo, dir } = tree(false)
  try {
    assert.deepEqual(embodied(repo, feat(dir)), [
      `${join(repo, dir, 'src', 'app', 'index.ts')}: note's notes has a record page but mounts no body: every record has one, by cella scaffold body note, or by hand where note keeps more than one kind's`,
    ])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('a collection with a record page and a mounted body passes', () => {
  const { repo, dir } = tree(true)
  try {
    assert.deepEqual(embodied(repo, feat(dir)), [])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test("document's documents, motion's motions and patronage's statements are left out: their body, if any, is their own", () => {
  for (const [name, kind] of [['document', 'documents'], ['motion', 'motions'], ['patronage', 'statements']]) {
    const { repo, dir } = tree(false, kind)
    try {
      assert.deepEqual(embodied(repo, [{ name, dir }]), [], `${name}'s ${kind}`)
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  }
})

test('any other kind of document, motion or patronage is refused as any feat\'s is', () => {
  for (const name of ['document', 'motion', 'patronage']) {
    const { repo, dir } = tree(false)
    try {
      assert.deepEqual(embodied(repo, [{ name, dir }]), [
        `${join(repo, dir, 'src', 'app', 'index.ts')}: ${name}'s notes has a record page but mounts no body: every record has one, by cella scaffold body ${name}, or by hand where ${name} keeps more than one kind's`,
      ])
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  }
})

test('a feat with no app/index.ts (a core collection, membership and employment, which only extend one) is skipped', () => {
  const repo = mkdtempSync(join(tmpdir(), 'embodied-'))
  try {
    assert.deepEqual(embodied(repo, [{ name: 'circle', dir: 'apps/org/core/circle/ts' }]), [])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})
