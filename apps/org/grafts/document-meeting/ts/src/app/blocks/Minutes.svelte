<script lang="ts">
  import { Button, Empty, Form, icons, Panel, type Embeds } from '@cella/org-ui'
  import { Reader } from '@cella/org-body/app'
  import type { OnMeeting } from '../../models/minutes.ts'

  // A meeting's minutes, a document written in the block editor: read
  // here from its draft, with the embeds the meeting's slices draw, and
  // written on the document's page, which its footer opens. Until they
  // are begun, beginning them, its footer's action, starts the document,
  // opening on the meeting's card and its agenda. A panel after the
  // meeting's body.
  let { data, embeds = {} }: { data: OnMeeting; id: string; embeds?: Embeds } = $props()

  const m = $derived(data.minutes)
  const stands = $derived(
    m ? [m.versions ? `${m.versions} ${m.versions === 1 ? 'version' : 'versions'}, the latest ${m.latest}` : 'no version saved', m.adopted ? `${m.adopted} adopted` : 'none adopted'] : null,
  )
</script>

{#snippet write()}
  {#if m}
    <Button tone="primary" href="/documents/{m.document}" lead={icons.PencilSimple}>Write in the editor</Button>
  {:else}
    <Form action="minute" button submit="Begin the minutes" lead={icons.Plus} />
  {/if}
{/snippet}

<Panel title="Minutes" icon={icons.FileText} meta={stands} actions={data.cancelled && !m ? undefined : write}>
  {#if m}
    <Reader canon={m.draft} label={m.title} {embeds} />
  {:else if data.cancelled}
    <Empty text="Cancelled: it has no minutes." />
  {:else}
    <Empty text="No minutes yet. Beginning them starts a document opening on this meeting and its agenda, written in the block editor." />
  {/if}
</Panel>
