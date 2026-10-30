<script lang="ts">
  import { Note, Section, Stats, Table, type Column } from '@cella/org-ui'
  import type { Drawn } from '../../models/report.ts'
  import type { Federation } from '../../models/federation.ts'

  // A distributed year's figures for the federation: its split, what its
  // entry posted, the capital it credited and its work share by basis.
  let { data }: { data: Drawn<Federation>; id: string } = $props()

  type Share = Federation['shares'][number]
  type Posted = Federation['posted'][number]
  type Part = Federation['parts'][number]
  const shares: Column<Share>[] = [
    { key: 'kind', label: 'Share', value: (s) => s.kind },
    { key: 'percent', label: '%', kind: 'number', value: (s) => Number(s.percent) },
    { key: 'amount', label: 'Amount', kind: 'money', value: (s) => s.amount },
  ]
  const posted: Column<Posted>[] = [
    { key: 'code', label: 'Account', kind: 'mono', value: (p) => p.code },
    { key: 'label', label: 'Label', value: (p) => p.label },
    { key: 'debit', label: 'Debit', kind: 'money', value: (p) => p.debit },
    { key: 'credit', label: 'Credit', kind: 'money', value: (p) => p.credit },
  ]
  const parts: Column<Part>[] = [
    { key: 'basis', label: 'Basis', value: (p) => p.basis },
    { key: 'workers', label: 'Workers', kind: 'number', value: (p) => p.workers },
    { key: 'quantity', label: 'Quantity', kind: 'number', value: (p) => p.quantity },
    { key: 'amount', label: 'Amount', kind: 'money', value: (p) => p.amount },
  ]
</script>

{#if data.report.kind === 'federation'}
  {#if data.drawn}
    {const f = $derived(data.drawn)}
    <Stats
      items={[
        { label: 'Surplus', value: f.surplus, kind: 'money' },
        { label: 'Workers sharing', value: f.workers, kind: 'number' },
        { label: 'Associates', value: f.associates, kind: 'number' },
        { label: 'Legal reserve', value: f.reserve, kind: 'money' },
      ]}
    />
    <Section title={`The ${f.year} split, distributed on ${f.distributed}`}>
      <Table columns={shares} rows={f.shares.map((s) => ({ ...s, id: s.kind }))} />
    </Section>
    <Section title="What it posted" count={f.posted.length}>
      <Table columns={posted} rows={f.posted.map((p) => ({ ...p, id: p.code }))} href={(p: Posted) => `/accounts/${p.code}`} />
    </Section>
    <Section title="Capital credited">
      <Stats
        items={[
          { label: 'Members', value: f.credited.members, kind: 'number' },
          { label: 'Shares', value: f.credited.shares, kind: 'number' },
          { label: 'Amount', value: f.credited.amount, kind: 'money' },
          { label: 'Blocked until', value: f.credited.until, kind: 'date' },
        ]}
      />
    </Section>
    <Section title="The work share by basis">
      <Table columns={parts} rows={f.parts.map((p) => ({ ...p, id: p.basis }))} />
    </Section>
    <Note text="A member's own statement is theirs, on Statements; which figures the federation's return asks for is not verified against its forms." />
  {:else}
    <Note text={data.failed ?? 'The figures are drawn once a year’s surplus is distributed.'} />
  {/if}
{/if}
