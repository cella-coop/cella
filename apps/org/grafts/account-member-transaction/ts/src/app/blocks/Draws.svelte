<script lang="ts">
  import { Field, Form, Note, Section, Stats, Table, type Column } from '@cella/org-ui'
  import type { Account, Drawing } from '../../models/draw.ts'

  // A member's capital in the books and their draws on it: what they drew,
  // of what limit, and a draw of their own while it is not frozen. A draw
  // beyond what is left of the limit is refused.
  let { data }: { data: Account; id: string } = $props()

  const columns: Column<Drawing>[] = [
    { key: 'entry', label: 'Entry', kind: 'mono', value: (d) => d.entry },
    { key: 'date', label: 'Date', kind: 'date', value: (d) => d.date },
    { key: 'amount', label: 'Amount', kind: 'money', value: (d) => d.amount },
  ]
  const left = $derived(data.allowance === null ? null : Math.max(data.allowance - data.drawn, 0))
</script>

{#if data.account}
  <Section title="Draws" count={data.draws.length}>
    <Stats
      items={[
        { label: 'Capital in the books', value: data.balance, kind: 'money' },
        { label: 'Drawn', value: data.drawn, kind: 'money' },
        { label: 'Left to draw', value: left, kind: 'money' },
      ]}
    />
    <Table {columns} rows={data.draws} href={(d: Drawing) => `/transactions/${d.entry}`} />
    {#if data.frozen}
      <Note text="Frozen since this member left: it takes no draw until it is repaid." />
    {:else if data.own && left}
      <Form action="draw" submit="Draw" tone="quiet" inline>
        <Field label="Amount, €" name="amount" required />
      </Form>
    {/if}
  </Section>
{/if}
