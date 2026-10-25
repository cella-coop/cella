<script lang="ts">
  import { Note, Section, Stats } from '@cella/org-ui'
  import type { Margin } from '../../models/margin.ts'

  // The project's margin: what it invoiced less what its time cost and its
  // approved expenses; its budget burn; and where both land at completion
  // at the pace so far.
  let { data }: { data: Margin | null; id: string } = $props()

  const said: Record<string, string> = {
    'budget spent': 'Its billable time has spent most of its budget while it is under way.',
    'over budget': 'At the pace so far, its time will spend more than its budget.',
    'thin margin': 'What it invoiced keeps less than the co-op’s margin threshold after its costs.',
  }
</script>

{#if data}
  <Section title="Margin">
    <Stats
      items={[
        { label: 'Invoiced', value: data.invoiced, kind: 'money' },
        { label: 'Time cost', value: data.cost, kind: 'money' },
        { label: 'Expenses', value: data.expenses, kind: 'money' },
        { label: 'Margin', value: data.margin, kind: 'money', tone: data.margin < 0 ? 'negative' : undefined },
        { label: 'Margin %', value: data.percent, kind: 'number' },
      ]}
    />
    <Stats
      items={[
        { label: 'Budget burn %', value: data.burn, kind: 'number', tone: data.watch === 'budget spent' ? 'warning' : undefined },
        { label: 'Spend at completion', value: data.forecast, kind: 'money', tone: data.watch === 'over budget' ? 'negative' : undefined },
        { label: 'Margin at completion', value: data.landing, kind: 'money', tone: data.landing !== null && data.landing < 0 ? 'negative' : undefined },
      ]}
    />
    {#if data.watch && said[data.watch]}
      <Note text={said[data.watch]} />
    {/if}
  </Section>
{/if}
