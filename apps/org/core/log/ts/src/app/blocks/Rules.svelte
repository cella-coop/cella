<script lang="ts">
  import { Card, Prose, Section } from '@cella/org-ui'
  import type { Detail } from '../../models/log.ts'

  // The rules that decided the entry, each by its owner, with the text the
  // entry's digest names.
  let { data }: { data: Detail; id: string } = $props()
</script>

<Section title="Decided by" count={data.texts.length}>
  {#each data.texts as r (r.function)}
    <Card title="{r.owner} · {r.function}">
      <Prose text={r.body ?? 'the rule text is not in the registry'} />
    </Card>
  {:else}
    <p>No rule attaches to this op; the notary checked the signature and the device alone.</p>
  {/each}
</Section>
