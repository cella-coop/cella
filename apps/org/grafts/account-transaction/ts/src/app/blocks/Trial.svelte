<script lang="ts">
  import { Stats } from '@cella/org-ui'
  import type { Balance } from '../../models/balance.ts'

  // The trial balance: the journal's debits and credits over the chart,
  // which agree when every entry balanced.
  let { rows }: { rows: Partial<Balance>[]; about: unknown } = $props()

  const debit = $derived(rows.reduce((s, r) => s + (r.debit ?? 0), 0))
  const credit = $derived(rows.reduce((s, r) => s + (r.credit ?? 0), 0))
  const cash = $derived(rows.filter((r) => (r as { cash?: boolean }).cash).reduce((s, r) => s + (r.balance ?? 0), 0))
</script>

<Stats
  items={[
    { label: 'Debits', value: debit, kind: 'money' },
    { label: 'Credits', value: credit, kind: 'money' },
    { label: 'Trial balance', value: debit === credit ? 'balances' : 'off', kind: 'badge', tone: debit === credit ? 'positive' : 'negative' },
    { label: 'Cash', value: cash, kind: 'money' },
  ]}
/>
