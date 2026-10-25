<script lang="ts">
  import { Field, Form, Section, Stats, Table, type Column } from '@cella/org-ui'
  import type { Instalment, Plan } from '../../models/plan.ts'

  // An associate's subscription paid from their pay: the instalments they
  // chose and what each month's pay withheld; on their own page, while
  // they owe some, spreading it again, within what the statutes allow.
  let { data }: { data: Plan; id: string } = $props()

  const columns: Column<Instalment>[] = [
    { key: 'month', label: 'Pay of', kind: 'mono', value: (i) => i.month },
    { key: 'entry', label: 'Entry', kind: 'mono', value: (i) => i.entry },
    { key: 'amount', label: 'Withheld', kind: 'money', value: (i) => i.amount },
  ]
</script>

{#if data.instalments !== null || (data.own && data.unpaid)}
  <Section title="Instalments from pay" count={data.withheld.length}>
    {#if data.instalments !== null}
      <Stats
        items={[
          { label: 'Instalments', value: data.instalments, kind: 'number' },
          { label: 'Each', value: data.each, kind: 'money' },
          { label: 'Since', value: data.since, kind: 'date' },
          { label: 'Withheld so far', value: data.withheld.length, kind: 'number' },
        ]}
      />
      <Table {columns} rows={data.withheld} href={(i: Instalment) => `/transactions/${i.entry}`} />
    {/if}
    {#if data.own && data.unpaid && data.allowed}
      <Form action="spread" submit="Spread from my pay" tone="quiet" inline>
        <Field label={`Instalments, at most ${data.allowed}`} name="instalments" type="number" required />
      </Form>
    {/if}
  </Section>
{/if}
