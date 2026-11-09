<script lang="ts">
  import { Note, Section, type Embeds } from '@cella/org-ui'
  import { Editor, Reader } from '@cella/org-body/app'
  import type { Page } from '../../models/document.ts'
  import { useDraft } from '../../hooks/useDraft.ts'

  // The draft, edited together: every member with the document open sees
  // the others' edits as they settle. The server renders it to read; the
  // editor takes it over once the browser holds the Loro document. Over
  // it, where the draft stands: the version it still is, or changed since
  // the last one; whether this member's edits are saved; and how a block
  // is added. Its canonical hash as the page was read, what a version
  // saved then is named by, is among the page's Properties. A generated
  // document is read, never edited: it changes only as its circle's
  // policies do.
  let { data, embeds = {} }: { data: Page; id: string; embeds?: Embeds } = $props()

  const draft = useDraft(() => data)
  const anchors = $derived(data.comments.filter((c) => !c.resolved && c.anchor).map((c) => c.anchor!))
  const hash = $derived(draft.sync?.hash ?? data.hash)
  const latest = $derived(data.versions[0])
  const stands = $derived(!latest ? 'A draft, never saved as a version' : latest.hash === hash ? `Saved as version ${latest.n}` : `A draft, changed since version ${latest.n}`)
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
  {#if data.generated}
    <Note text="Generated from the policies of {data.generated} at each adoption · {data.adopted ? `adopted as ${data.adopted}` : 'not adopted'} · not edited by hand" />
    <Reader canon={data.draft} label={data.title} {embeds} />
  {:else}
    <div data-sync={draft.sync?.online ? 'live' : 'off'} data-hash={hash} data-state={state}>
      <Note text="{stands} · edits {state} · type / for blocks" />
    </div>
    {#if draft.doc}
      <Editor doc={draft.doc} name={data.title} {anchors} {embeds} />
    {:else}
      <Reader canon={data.draft} label={data.title} {embeds} readonly={false} />
    {/if}
  {/if}
</Section>
