<script lang="ts">
  import { date, icons, money, Panel, Prose, Stats } from '@cella/org-ui'
  import type { Terms } from '../../models/terms.ts'

  // The capital clauses the terms hold, adopted or still drafted: the
  // overview's panel, its figures first, as tiles, then the clauses said
  // as the statutes say them (the operator, 20 Nov: a sentence alone read
  // "a bit meh").
  let { data }: { data: Terms; id: string } = $props()

  const shares = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  const figures = $derived([
    { label: 'A share', value: data.share, kind: 'money' as const },
    { label: 'Least subscription', value: `${shares(data.minimum, 'share', 'shares')} · ${money(data.minimum * data.share)}` },
    { label: 'Paid in', value: `≤ ${shares(data.instalments, 'instalment', 'instalments')}` },
    { label: 'Repaid after leaving', value: `${shares(data.delay, 'month', 'months')}` },
    { label: 'Repaid in', value: `≤ ${shares(data.repayments, 'yearly repayment', 'yearly repayments')}` },
  ])
</script>

<Panel
  title="Clauses"
  icon={icons.SealCheck}
  status={data.adopted ? { label: 'adopted', tone: 'positive' } : { label: 'drafted', tone: 'accent' }}
  meta={data.adopted ? date(data.adopted) : null}
>
  <Stats items={figures} />
  <Prose
    text={`A share is worth ${money(data.share)}. An associate subscribes at least ${shares(data.minimum, 'share', 'shares')}, paid in at most ${shares(data.instalments, 'instalment', 'instalments')}. One who leaves is repaid ${data.delay} months after, in at most ${shares(data.repayments, 'yearly repayment', 'yearly repayments')}.`}
  />
</Panel>
