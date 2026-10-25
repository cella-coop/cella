<script lang="ts">
  import { Section, Stats, Table, type Column } from '@cella/org-ui'
  import type { Employed, Movement } from '../../models/patronage.ts'

  // What a worker's part became: the shares it bought, blocked until the
  // day the law sets, the cash it left, and their capital account's
  // movements with the balance after each.
  let { data }: { data: Employed | null; id: string } = $props()

  const columns: Column<Movement>[] = [
    { key: 'date', label: 'Date', kind: 'date', value: (m) => m.date },
    { key: 'label', label: 'Entry', value: (m) => m.label },
    { key: 'amount', label: 'Amount', kind: 'money', value: (m) => (m.side === 'credit' ? m.amount : -m.amount) },
    { key: 'balance', label: 'Balance', kind: 'money', value: (m) => m.balance },
  ]
</script>

{#if data}
  <Section title="Paid and employed in shares">
    <Stats
      items={[
        { label: 'Part', value: data.part, kind: 'money' },
        { label: 'Paid in cash', value: data.cash, kind: 'money' },
        { label: 'In shares', value: data.capital, kind: 'money' },
        { label: 'Shares', value: data.shares, kind: 'number' },
        { label: 'Blocked until', value: data.until, kind: 'date' },
      ]}
    />
  </Section>
  {#if data.movements.length}
    <Section title="Capital account{data.account ? ` ${data.account}` : ''}" count={data.movements.length}>
      <Table {columns} rows={data.movements} href={(m: Movement) => `/transactions/${m.entry}`} />
    </Section>
  {/if}
{/if}
