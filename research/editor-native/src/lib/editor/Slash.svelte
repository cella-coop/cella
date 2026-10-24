<script lang="ts">
  import { useEditor } from '../hooks/useEditor.ts'

  const ed = useEditor()
  const sl = $derived(ed.slash!)
</script>

<div class="menu" role="listbox" aria-label="Turn into" style:left="{sl.x}px" style:top="{sl.y + 4}px">
  {#each ed.matches as item, i (item.label)}
    <button
      role="option"
      aria-selected={i === sl.index}
      class:active={i === sl.index}
      tabindex="-1"
      onpointerdown={(e) => e.preventDefault()}
      onclick={() => ed.choose(item)}
    >
      <span>{item.label}</span>
      <span class="hint">{item.hint}</span>
    </button>
  {:else}
    <div class="none">No match</div>
  {/each}
</div>

<style>
  .menu {
    position: fixed;
    z-index: 10;
    min-width: 13rem;
    max-height: 18rem;
    overflow: auto;
    background: var(--float);
    border: 1px solid var(--line);
    border-radius: var(--radius-float);
    box-shadow: var(--shadow-float);
    padding: var(--space-1);
    display: flex;
    flex-direction: column;
  }

  button {
    display: flex;
    justify-content: space-between;
    gap: var(--space-4);
    border: none;
    background: none;
    text-align: left;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-control);
    cursor: pointer;
  }

  .active {
    background: var(--hover);
  }

  .hint,
  .none {
    color: var(--text-subtle);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .none {
    padding: var(--space-1) var(--space-2);
  }
</style>
