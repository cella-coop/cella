<script lang="ts">
  import { Empty, Field, icons, Panel, Prose } from '@cella/org-ui'
  import type { Detail } from '../../models/log.ts'

  // The guards that decided the entry, each its owner and function over
  // the text the entry's digest names, read-only: the entry's overview
  // panel.
  let { data }: { data: Detail; id: string } = $props()
</script>

<Panel title="Decided by" icon={icons.Scales} count={data.texts.length}>
  {#each data.texts as r (r.function)}
    <Field readonly label="{r.owner} · {r.function}">
      <Prose text={r.body ?? 'the guard text is not in the registry'} />
    </Field>
  {:else}
    <Empty text="No guard attaches to this op; the notary checked the signature and the device alone." />
  {/each}
</Panel>
