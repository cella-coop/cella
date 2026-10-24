<script lang="ts">
  import { Floating } from '@cella/org-ui'
  import { useEditor } from '../hooks/useEditor.ts'

  // The slash menu at the caret: what the block turns into, filtered by
  // what follows the `/`; the arrow keys and Enter choose, from the block.
  const ed = useEditor()
  const sl = $derived(ed.menu.slash)
</script>

{#if sl}
  <Floating x={sl.x} y={sl.y} label="Turn into" role="listbox">
    {#each ed.menu.matches as item, i (item.label)}
      <button role="option" aria-selected={i === sl.index} tabindex="-1" onclick={() => ed.menu.choose(item)}>
        <span>{item.label}</span>
        <span class="hint">{item.hint}</span>
      </button>
    {:else}
      <div class="none">No match</div>
    {/each}
  </Floating>
{/if}
