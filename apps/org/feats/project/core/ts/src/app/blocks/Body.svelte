<script lang="ts">
  import { Note, type Embeds } from '@cella/org-ui'
  import { Editor, Reader } from '@cella/org-body/app'
  import type { Bodied } from '../../models/body.ts'
  import { useBody } from '../../hooks/useBody.ts'

  // The project's body, its free-form content, edited together over core
  // body's live session: every member with it open sees the others' edits
  // as they make them, and each browser saves at a pause and on leaving.
  // The server renders it to read; the editor takes it over once the
  // session says this member may edit it, and one who may read the project
  // and not discuss it reads it as it changes. Over it, whether this
  // member's edits are saved, and how a block is added.
  let { data, embeds = {} }: { data: Bodied & { id: string; title: string }; id: string; embeds?: Embeds } = $props()

  const body = useBody(() => data)
  const canon = $derived(body.canon ?? { v: 1 as const, blocks: [] })
  const state = $derived.by(() => {
    const l = body.live
    if (!l || !l.joined) {
      return 'opening'
    }
    if (l.problem) {
      return `not saved: ${l.problem}`
    }
    if (!l.writable) {
      return 'read-only'
    }
    if (!l.online) {
      return l.unsaved ? 'offline, edits wait' : 'offline'
    }
    return l.unsaved ? 'saving' : 'saved'
  })
  // The empty line already hints how a block is added; this line only
  // says whether the edit stood, so it says that alone, dimmer, by the
  // box it stands for.
  const banner = $derived(state === 'opening' ? 'Opening the body' : !body.live?.writable ? (body.live?.problem ?? 'Read-only: editing it needs discuss in its circle') : null)
  const saved = $derived(`Edits ${state}`)
</script>

<div data-body={body.live?.writable ? 'edit' : 'read'} data-hash={body.live?.hash ?? ''} data-state={state}>
  <Note text={banner ?? ''} />
</div>
{#if body.doc && body.live?.writable}
  <Editor doc={body.doc} name={data.title} {embeds} />
{:else}
  <Reader {canon} label={data.title} {embeds} readonly={!!body.live?.joined} />
{/if}
{#if body.live?.writable}
  <Note text={saved} subtle end />
{/if}
