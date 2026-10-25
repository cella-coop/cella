// seed, files: loads a mock co-op's files into the file feat, each one's
// bytes read from the fixture's files/ directory, and the grafts that
// attach them (expense-file's receipts, file-membership's and employment-file's
// records). The expenses, members and workers load first.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export async function files(db, read, day, dir) {
  const kept = read('file').file ?? []
  for (const f of kept) {
    const bytes = readFileSync(join(dir, 'files', f.name))
    await db.query(
      `INSERT INTO file.file (id, class, subject, name, type, size, bytes, uploader, uploaded)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [f.id, f.class, f.subject ?? null, f.name, f.type, bytes.length, bytes, f.uploader, day(f.uploaded)],
    )
  }
  if (kept.length) {
    await db.query(`SELECT setval('file.number', $1)`, [Math.max(...kept.map((f) => Number(f.id.slice(3))))])
  }
  for (const r of read('graft.expense-file').receipt ?? []) {
    await db.query('INSERT INTO expense_file.receipt (expense, file) VALUES ($1, $2)', [r.expense, r.file])
  }
  for (const r of read('graft.file-membership').record ?? []) {
    await db.query('INSERT INTO file_membership.record (member, file) VALUES ($1, $2)', [r.member, r.file])
  }
  for (const r of read('graft.employment-file').record ?? []) {
    await db.query('INSERT INTO employment_file.record (worker, file) VALUES ($1, $2)', [r.worker, r.file])
  }
  return `${kept.length} files`
}
