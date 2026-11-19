<script lang="ts">
  import { Button, icons, Panel, Stats, Table, type Column } from '@cella/org-ui'
  import type { Ledger, Movement } from '../../models/balance.ts'

  // What the account holds: its debits, credits and balance, and the
  // latest lines posted to it, summarising its ledger, which its Ledger
  // tab lists whole and its footer opens. The account's overview panel.
  let { data, id }: { data: Ledger; id: string } = $props()

  const columns: Column<Movement>[] = [
    { key: 'date', label: 'Date', kind: 'date', value: (m) => m.date },
    { key: 'label', label: 'Label', value: (m) => m.label },
    { key: 'debit', label: 'Debit', kind: 'money', value: (m) => (m.side === 'debit' ? m.cents : null) },
    { key: 'credit', label: 'Credit', kind: 'money', value: (m) => (m.side === 'credit' ? m.cents : null) },
  ]
  const latest = $derived([...data.movements].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 3))
</script>

{#snippet open()}
  <Button href="/accounts/{id}?tab=ledger" lead={icons.ArrowRight}>Open the ledger</Button>
{/snippet}

<Panel title="Balance" icon={icons.Bank} meta="{data.movements.length} {data.movements.length === 1 ? 'line' : 'lines'} posted" actions={latest.length ? open : undefined}>
  <Stats
    items={[
      { label: 'Debit', value: data.debit, kind: 'money' },
      { label: 'Credit', value: data.credit, kind: 'money' },
      { label: 'Balance', value: data.balance, kind: 'money', tone: data.balance < 0 ? 'negative' : undefined },
    ]}
  />
  {#if latest.length}
    <Table dense {columns} rows={latest} href={(m: Movement) => `/transactions/${m.entry}`} />
  {/if}
</Panel>
