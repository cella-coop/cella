<script lang="ts">
  import { date, icons, money, Panel, Prose } from '@cella/org-ui'
  import type { Terms } from '../../models/terms.ts'

  // The capital clauses the terms hold, said as the statutes say them,
  // adopted or still drafted: the overview's panel.
  let { data }: { data: Terms; id: string } = $props()

  const shares = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
</script>

<Panel
  title="Clauses"
  icon={icons.SealCheck}
  status={data.adopted ? { label: 'adopted', tone: 'positive' } : { label: 'drafted', tone: 'accent' }}
  meta={data.adopted ? date(data.adopted) : null}
>
  <Prose
    text={`A share is worth ${money(data.share)}. An associate subscribes at least ${shares(data.minimum, 'share', 'shares')}, paid in at most ${shares(data.instalments, 'instalment', 'instalments')}. One who leaves is repaid ${data.delay} months after, in at most ${shares(data.repayments, 'yearly repayment', 'yearly repayments')}.`}
  />
</Panel>
