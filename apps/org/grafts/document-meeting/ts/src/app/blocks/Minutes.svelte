<script lang="ts">
  import { Button, Form, Note, Section, type Embeds } from '@cella/org-ui'
  import { Reader } from '@cella/org-document/app'
  import type { OnMeeting } from '../../models/minutes.ts'

  // A meeting's minutes, a document written in the block editor: read
  // here from its draft, with the embeds the meeting's slices draw, and
  // written on the document's page. Until they are begun, beginning them
  // starts the document, opening on the meeting's card and its agenda.
  let { data, embeds = {} }: { data: OnMeeting; id: string; embeds?: Embeds } = $props()

  const m = $derived(data.minutes)
  const stands = $derived(
    m
      ? [m.versions ? `${m.versions} ${m.versions === 1 ? 'version' : 'versions'}, the latest ${m.latest}` : 'no version saved', m.adopted ? `${m.adopted} adopted` : 'none adopted'].join(' · ')
      : '',
  )
</script>

<Section title="Minutes">
  {#if m}
    <Reader canon={m.draft} label={m.title} {embeds} />
    <Note text={stands} />
    <div>
      <Button tone="primary" href="/documents/{m.document}">Write in the editor</Button>
    </div>
  {:else if data.cancelled}
    <Note text="Cancelled: it has no minutes." />
  {:else}
    <Note text="No minutes yet. Beginning them starts a document opening on this meeting and its agenda, written in the block editor." />
    <Form action="minute" submit="Begin the minutes" />
  {/if}
</Section>
