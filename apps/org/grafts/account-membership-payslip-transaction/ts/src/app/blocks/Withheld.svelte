<script lang="ts">
  import { icons, Panel, Stats } from '@cella/org-ui'
  import type { Withheld } from '../../models/plan.ts'

  // What this payslip's pay withheld for its member's subscription, and
  // what the bank paid them of their net, the entry that booked it
  // linked: a panel of the payslip's overview, where its pay withheld
  // any.
  let { data }: { data: Withheld | null; id: string } = $props()
</script>

{#if data}
  <Panel title="Withheld for capital" icon={icons.PiggyBank}>
    <Stats
      items={[
        { label: 'Net pay', value: data.net, kind: 'money' },
        { label: 'Withheld', value: data.amount, kind: 'money' },
        { label: 'Paid by the bank', value: data.net === null ? null : data.net - data.amount, kind: 'money' },
        { label: 'Entry', value: data.entry, kind: 'mono', href: `/transactions/${data.entry}` },
      ]}
    />
  </Panel>
{/if}
