<script lang="ts">
  import { Section, Stats } from '@cella/org-ui'
  import type { Capital } from '../../models/capital.ts'

  // A member's capital: what they subscribed, their shares at the share's
  // value, and whether it is frozen since they left.
  let { data }: { data: Capital | null; id: string } = $props()
</script>

{#if data && data.account}
  <Section title="Capital">
    <Stats
      items={[
        { label: 'Subscribed', value: data.subscribed, kind: 'money' },
        { label: 'Shares', value: data.shares, kind: 'number' },
        { label: 'Share value', value: data.value, kind: 'money' },
        { label: 'Account', value: data.account, kind: 'mono', href: `/accounts/${data.account}` },
        { label: 'State', value: data.frozen ? 'frozen' : 'open', kind: 'badge', tone: data.frozen ? 'warning' : 'positive' },
      ]}
    />
  </Section>
{/if}
