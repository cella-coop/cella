import type { Analytics, Head } from '@cella/org-analytics'
import type { Federation } from '../models/federation.ts'

// A distributed year's figures, the latest unless one is asked, through
// the port: its split, what its entry posted by account, the capital it
// credited, its work share by basis, the members active and the legal
// reserve as the books stand. Null before any year is distributed.
export async function federation(port: Analytics, asked: number | null): Promise<{ head: Head; federation: Federation | null }> {
  const years = await port.run({
    from: { d: 'patronage.distributions' },
    fields: ['d.id', 'd.year', 'd.surplus', 'd.distributed'],
    where: [{ field: 'd.distributed', op: 'not null' }],
    order: ['-d.year'],
  })
  const d = years.rows.find((r) => r['d.year'] === asked) ?? years.rows[0]
  if (!d) {
    return { head: years.head, federation: null }
  }
  const id = d['d.id'] as string
  const of = (field: string) => [{ field, op: '=' as const, value: id }]
  const [shares, posted, credits, parts, members, reserve] = await Promise.all([
    port.run({ from: { s: 'patronage.shares' }, fields: ['s.kind', 's.percent', 's.amount'], where: of('s.distribution') }),
    port.run({
      from: { x: 'account_membership_patronage_transaction.posted', c: 'account.chart' },
      join: [['c.code', 'x.code']],
      outer: ['c'],
      fields: ['x.code', 'c.label', 'x.debit', 'x.credit'],
      where: of('x.distribution'),
      order: ['x.code'],
    }),
    port.run({ from: { c: 'account_membership_patronage_transaction.credits' }, fields: ['c.members', 'c.shares', 'c.amount', 'c.until'], where: of('c.distribution') }),
    port.run({ from: { p: 'patronage.parts' }, fields: ['p.basis', 'p.workers', 'p.quantity', 'p.amount'], where: of('p.distribution'), order: ['p.basis'] }),
    port.run({ from: { m: 'membership.members' }, measures: { n: { fn: 'count' } }, where: [{ field: 'm.status', op: '=', value: 'active' }] }),
    port.run({
      from: { m: 'account_transaction.movements' },
      measures: { debit: { fn: 'sum', of: 'm.debit' }, credit: { fn: 'sum', of: 'm.credit' } },
      where: [{ field: 'm.code', op: '=', value: '1061' }],
    }),
  ])
  const c = credits.rows[0]
  const r = reserve.rows[0]
  const order = ['legal', 'development', 'work', 'interest']
  return {
    head: years.head,
    federation: {
      distribution: id,
      year: Number(d['d.year']),
      distributed: d['d.distributed'] as string,
      surplus: Number(d['d.surplus']),
      shares: shares.rows
        .map((s) => ({ kind: s['s.kind'] as string, percent: String(s['s.percent']), amount: Number(s['s.amount']) }))
        .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)),
      posted: posted.rows.map((x) => ({
        code: x['x.code'] as string,
        label: (x['c.label'] as string | null) ?? '',
        debit: Number(x['x.debit']),
        credit: Number(x['x.credit']),
      })),
      credited: {
        members: Number(c?.['c.members'] ?? 0),
        shares: Number(c?.['c.shares'] ?? 0),
        amount: Number(c?.['c.amount'] ?? 0),
        until: (c?.['c.until'] as string | null) ?? null,
      },
      parts: parts.rows.map((p) => ({
        basis: p['p.basis'] as string,
        workers: Number(p['p.workers']),
        quantity: Number(p['p.quantity']),
        amount: Number(p['p.amount']),
      })),
      workers: Math.max(0, ...parts.rows.map((p) => Number(p['p.workers']))),
      associates: Number(members.rows[0]?.n ?? 0),
      reserve: Number(r?.credit ?? 0) - Number(r?.debit ?? 0),
      years: years.rows.map((y) => Number(y['d.year'])),
    },
  }
}
