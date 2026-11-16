<script lang="ts">
  import { Select } from '@cella/org-ui'
  import { useEditor } from '../../hooks/useEditor.ts'
  import type { View } from '../../hooks/EditorState.svelte.ts'

  // A thing of another slice, drawn by the slice that knows its kind; the
  // document holds only its kind and ref. Inserted from the slash menu it
  // has a kind and no ref yet, and asks which record it shows: its picker
  // takes the focus, its arrows browse the choices without picking, and
  // Enter or a press picks one.
  let { view }: { view: View } = $props()
  const ed = useEditor()
  const found = $derived(ed.embeds()[view.props.embed ?? ''])
  const choices = $derived(found?.embed.choices?.(found.data) ?? [])
</script>

<div class="embed" data-atomic={view.id} contenteditable="false">
  {#if found && !view.props.ref}
    <div class="pick">
      <span class="kind">{found.embed.label}</span>
      <Select
        fit
        focus
        label="Which {found.embed.label.toLowerCase()} this block shows"
        placeholder="Choose a {found.embed.label.toLowerCase()}…"
        options={choices.map((c) => ({ value: c.ref, label: `${c.label} · ${c.ref}` }))}
        bind:value={() => '', (ref) => ref && ed.menu.pick(view.id, String(view.props.embed), ref)}
      />
    </div>
  {:else if found}
    <found.embed.block ref={view.props.ref ?? ''} data={found.data} />
  {:else}
    <div class="unknown">{view.props.embed} {view.props.ref}</div>
  {/if}
</div>
