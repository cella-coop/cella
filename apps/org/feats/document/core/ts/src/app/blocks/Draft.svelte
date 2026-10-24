<script lang="ts">
  import { Form, Note, Section, short, type Embeds } from '@cella/org-ui'
  import type { Page } from '../../models/document.ts'
  import { useDraft } from '../../hooks/useDraft.ts'
  import Editor from '../../components/Editor.svelte'
  import Reader from '../../components/Reader.svelte'

  // The draft, edited together: every member with the document open sees
  // the others' edits as they settle. The server renders it to read; the
  // editor takes it over once the browser holds the Loro document. Under
  // it, the draft's canonical hash, what a version saved now is named by,
  // and whether this member's edits are saved.
  let { data, embeds = {} }: { data: Page; id: string; embeds?: Embeds } = $props()

  const draft = useDraft(() => data)
  const anchors = $derived(data.comments.filter((c) => !c.resolved && c.anchor).map((c) => c.anchor!))
  const state = $derived.by(() => {
    const s = draft.sync
    if (!s) {
      return 'opening'
    }
    if (s.problem) {
      return `not saved: ${s.problem}`
    }
    if (!s.online) {
      return s.waiting ? 'offline, edits wait' : 'offline'
    }
    return s.waiting ? 'saving' : 'saved'
  })
</script>

<Section title="Draft">
  {#if draft.doc}
    <Editor doc={draft.doc} name={data.title} {anchors} {embeds} />
  {:else}
    <Reader canon={data.draft} label={data.title} {embeds} readonly={false} />
  {/if}
  <div data-sync={draft.sync?.online ? 'live' : 'off'} data-hash={draft.sync?.hash ?? data.hash}>
    <Note text="BLAKE3 {short(draft.sync?.hash ?? data.hash, 16)} · {state}" />
  </div>
</Section>

<Section title="Versions">
  <Form action="version" submit="Save the draft as a version" tone="quiet" />
</Section>
