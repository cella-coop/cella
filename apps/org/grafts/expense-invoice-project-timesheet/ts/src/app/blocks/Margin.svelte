<script lang="ts">
  import { money, Note, Section, Stats } from '@cella/org-ui'
  import type { Margin } from '../../models/margin.ts'

  // The project's margin: why it is watched and what to do about it first,
  // then what it invoiced less what its time cost and its approved
  // expenses, then its budget burn and where both land at completion at
  // the pace so far, each row with the basis it is reckoned on.
  let { data }: { data: Margin | null; id: string } = $props()

  const lead = $derived.by(() => {
    if (!data) {
      return null
    }
    switch (data.watch) {
      case 'budget spent':
        return `Budget spent: its billable time has spent ${data.burn} % of its ${money(data.budget)} budget while it is under way. Agree what is left with the client, or change the budget.`
      case 'over budget':
        return `Forecast over budget: at the pace so far, its billable time will spend ${money(data.forecast)} of its ${money(data.budget)} budget by its due day. Agree the overrun with the client, or change the budget.`
      case 'thin margin':
        return `Thin margin: after its time cost and expenses it keeps ${data.percent} % of what it invoiced, under the co-op’s threshold. Check its time and expenses against what is left to invoice.`
      default:
        return null
    }
  })
</script>

{#if data}
  <Section title="Margin">
    {#if lead}
      <Note text={lead} />
    {/if}
    <Stats
      items={[
        { label: 'Invoiced', value: data.invoiced, kind: 'money' },
        { label: 'Time cost', value: data.cost, kind: 'money' },
        { label: 'Expenses', value: data.expenses, kind: 'money' },
        { label: 'Margin', value: data.margin, kind: 'money', tone: data.margin < 0 ? 'negative' : undefined },
        { label: 'Margin %', value: data.percent, kind: 'number' },
      ]}
    />
    <Note text="Time cost is every hour, billable or not, at the co-op’s cost rate: what an hour costs it in pay and contributions. Expenses count once approved." />
    <Stats
      items={[
        { label: 'Budget spent %', value: data.burn, kind: 'number', tone: data.watch === 'budget spent' ? 'warning' : undefined },
        { label: 'Spend at completion', value: data.forecast, kind: 'money', tone: data.watch === 'over budget' ? 'negative' : undefined },
        { label: 'Margin at completion', value: data.landing, kind: 'money', tone: data.landing !== null && data.landing < 0 ? 'negative' : undefined },
      ]}
    />
    <Note text="The budget is spent by billable time at the billing rate, what the client is charged, so a project can run over its budget and still keep a margin. At completion carries the pace so far to its due day; the margin there is its budget, or what it invoiced where it has none, less its costs." />
  </Section>
{/if}
