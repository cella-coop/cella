<script lang="ts">
  import { date, Empty, icons, Panel, Stats, Table, type Column, type Tone } from '@cella/org-ui'
  import type { Detail, Received } from '../../models/invoice.ts'

  // Where the invoice stands: what was received for it and what is still
  // owed, its standing and when it falls due at the panel's head.
  let { data }: { data: Detail; id: string } = $props()

  const tones: Record<string, Tone> = { overdue: 'warning', unpaid: 'accent', partial: 'accent', paid: 'positive', overpaid: 'warning', voided: 'neutral' }
  const standing = $derived(data.overdue ? 'overdue' : data.state)
  const payments: Column<Received>[] = [
    { key: 'at', label: 'Received', kind: 'date', value: (p) => p.at },
    { key: 'reference', label: 'Reference', kind: 'mono', value: (p) => p.reference },
    { key: 'method', label: 'Method', value: (p) => p.method },
    { key: 'amount', label: 'Amount', kind: 'money', value: (p) => p.amount },
  ]
</script>

<Panel title="Payments" icon={icons.Money} count={data.payments.length} status={{ label: standing, tone: tones[standing] }} meta={data.voided ? null : `due ${date(data.due)}`}>
  <Stats
    items={[
      { label: 'Paid', value: data.paid, kind: 'money' },
      { label: 'Owed', value: data.owed, kind: 'money', tone: data.overdue ? 'warning' : undefined },
      ...(data.credit ? [{ label: 'Credit owed back', value: data.credit, kind: 'money' as const }] : []),
    ]}
  />
  {#if data.payments.length}
    <Table dense columns={payments} rows={data.payments} />
  {:else}
    <Empty text="Nothing received for it yet." />
  {/if}
</Panel>
