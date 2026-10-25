<script lang="ts">
  import { Section, Stats } from '@cella/org-ui'
  import type { Withheld } from '../../models/plan.ts'

  // What this payslip's pay withheld for its member's subscription, and
  // what the bank paid them of their net.
  let { data }: { data: Withheld | null; id: string } = $props()
</script>

{#if data}
  <Section title="Withheld for capital">
    <Stats
      items={[
        { label: 'Net pay', value: data.net, kind: 'money' },
        { label: 'Withheld', value: data.amount, kind: 'money' },
        { label: 'Paid by the bank', value: data.net === null ? null : data.net - data.amount, kind: 'money' },
        { label: 'Entry', value: data.entry, kind: 'mono', href: `/transactions/${data.entry}` },
      ]}
    />
  </Section>
{/if}
