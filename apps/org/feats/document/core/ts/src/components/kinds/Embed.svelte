<script lang="ts">
  import { useEditor } from '../../hooks/useEditor.ts'
  import type { View } from '../../hooks/EditorState.svelte.ts'

  // A thing of another slice, drawn by the slice that knows its kind; the
  // document holds only its kind and ref. Inserted from the slash menu it
  // has a kind and no ref yet, and asks which record it shows.
  let { view }: { view: View } = $props()
  const ed = useEditor()
  const found = $derived(ed.embeds()[view.props.embed ?? ''])
  const choices = $derived(found?.embed.choices?.(found.data) ?? [])
</script>

<div class="embed" data-atomic={view.id} contenteditable="false">
  {#if found && !view.props.ref}
    <label class="pick">
      <span class="kind">{found.embed.label}</span>
      <select
        aria-label="Which {found.embed.label.toLowerCase()} this block shows"
        onchange={(e) => ed.menu.pick(view.id, String(view.props.embed), e.currentTarget.value)}
        {@attach (el) => el.focus()}
      >
        <option value="" selected disabled>Choose a {found.embed.label.toLowerCase()}…</option>
        {#each choices as c (c.ref)}
          <option value={c.ref}>{c.label} · {c.ref}</option>
        {/each}
      </select>
    </label>
  {:else if found}
    <found.embed.block ref={view.props.ref ?? ''} data={found.data} />
  {:else}
    <div class="unknown">{view.props.embed} {view.props.ref}</div>
  {/if}
</div>
