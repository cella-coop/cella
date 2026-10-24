<script lang="ts">
  import { useEditor } from '../hooks/useEditor.ts'

  const ed = useEditor()
  const bar = $derived(ed.bar!)
  const tools = [
    { key: 'bold', label: 'B', title: 'Bold (Ctrl-B)' },
    { key: 'italic', label: 'I', title: 'Italic (Ctrl-I)' },
    { key: 'code', label: '</>', title: 'Code (Ctrl-E)' },
    { key: 'link', label: 'Link', title: 'Link (Ctrl-K)' },
  ] as const
</script>

<div class="bar" role="toolbar" aria-label="Format" style:left="{bar.x}px" style:top="{bar.y - 40}px">
  {#each tools as t (t.key)}
    <button
      class={t.key}
      title={t.title}
      tabindex="-1"
      onpointerdown={(e) => e.preventDefault()}
      onclick={() => (t.key === 'link' ? ed.link() : ed.mark(t.key))}
    >
      {t.label}
    </button>
  {/each}
</div>

<style>
  .bar {
    position: fixed;
    z-index: 10;
    display: flex;
    gap: 2px;
    background: var(--float);
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    box-shadow: var(--shadow-float);
    padding: 2px;
  }

  button {
    border: none;
    background: none;
    min-width: 2rem;
    height: 1.9rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: var(--text-sm);
  }

  button:hover {
    background: var(--hover);
  }

  .bold {
    font-weight: 700;
  }

  .italic {
    font-style: italic;
  }

  .code {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }
</style>
