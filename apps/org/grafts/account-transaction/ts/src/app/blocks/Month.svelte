<script lang="ts">
  import { Button, icons, Panel, Stats } from '@cella/org-ui'
  import type { Dated } from '../../models/balance.ts'

  // What the period's books hold: how many entries are dated in it and
  // what they moved, summarising its Entries tab, which its footer opens.
  // The period's overview panel.
  let { data, id }: { data: Dated[]; id: string } = $props()

  const moved = $derived(data.reduce((s, e) => s + e.amount, 0))
</script>

{#snippet open()}
  <Button href="/periods/{id}?tab=entries" lead={icons.ArrowRight}>Open the entries</Button>
{/snippet}

<Panel title="Entries" icon={icons.ArrowsLeftRight} actions={data.length ? open : undefined}>
  <Stats
    items={[
      { label: 'Entries', value: data.length, kind: 'number' },
      { label: 'Moved', value: moved, kind: 'money' },
    ]}
  />
</Panel>
