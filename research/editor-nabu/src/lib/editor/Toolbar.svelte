<script lang="ts">
  // The inline toolbar over a selection in this editor, and the link field
  // Cmd-K opens. nabu's FloatingToolbar reads the page's selection, so with
  // two editors both would show; this one checks its own root.
  import type { EditorState } from '../hooks/EditorState.svelte.ts'

  let { editor }: { editor: EditorState } = $props()
  const engine = $derived(editor.engine)

  const marks = [
    { key: 'bold', label: 'B', title: 'Bold (Ctrl+B)' },
    { key: 'italic', label: 'I', title: 'Italic (Ctrl+I)' },
    { key: 'code', label: '</>', title: 'Code (Ctrl+E)' },
    { key: 'strikethrough', label: 'S', title: 'Strikethrough (Ctrl+Shift+X)' },
  ]

  let field: HTMLInputElement | null = $state(null)
  let held = $state({ top: 0, left: 0 })

  const place = $derived.by(() => {
    const sel = engine.selection
    const range = sel.firstRange
    if (sel.isCollapsed || !range || !editor.root?.contains(range.commonAncestorContainer)) {
      return null
    }
    const r = range.getBoundingClientRect()
    if (!r.width && !r.height) {
      return null
    }
    return { top: Math.max(8, r.top - 44), left: r.left + r.width / 2 }
  })

  // The link field keeps the toolbar where it was when it opened.
  const shown = $derived(editor.link ? held : place)

  $effect(() => {
    if (place && !editor.link) {
      held = place
    }
  })

  $effect(() => {
    if (editor.link) {
      field?.focus()
    }
  })

  function submit(e: SubmitEvent) {
    e.preventDefault()
    editor.applyLink(editor.link?.href ?? '')
  }
</script>

{#if shown}
  <div class="toolbar" data-nabu-ui contenteditable="false" style:top="{shown.top}px" style:left="{shown.left}px">
    {#if editor.link}
      <form onsubmit={submit}>
        <input
          bind:this={field}
          bind:value={editor.link.href}
          placeholder="https://"
          aria-label="Link address"
          onkeydown={(e) => {
            if (e.key === 'Escape') {
              editor.link = null
            }
          }}
        />
      </form>
    {:else}
      {#each marks as m (m.key)}
        <button
          type="button"
          title={m.title}
          class:on={engine.isMarkActive(m.key)}
          onmousedown={(e) => {
            e.preventDefault()
            engine.exec('mark:toggle', { mark: m.key })
          }}>{m.label}</button
        >
      {/each}
      <button
        type="button"
        title="Link (Ctrl+K)"
        class:on={engine.isMarkActive('link')}
        onmousedown={(e) => {
          e.preventDefault()
          if (engine.isMarkActive('link')) {
            engine.exec('link:remove')
          } else {
            editor.startLink()
          }
        }}>Link</button
      >
    {/if}
  </div>
{/if}

<style>
  .toolbar {
    position: fixed;
    transform: translateX(-50%);
    display: flex;
    gap: 2px;
    padding: 4px;
    background: var(--float);
    border: 1px solid var(--line);
    border-radius: var(--radius-float);
    box-shadow: var(--shadow-float);
    z-index: 100;
    font-family: var(--font-ui);
  }
  button {
    padding: 2px 8px;
    border: none;
    background: transparent;
    border-radius: var(--radius-control);
    cursor: pointer;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text);
  }
  button:hover {
    background: var(--hover);
  }
  .on {
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  input {
    min-width: 16rem;
    min-height: 1.75rem;
  }
</style>
