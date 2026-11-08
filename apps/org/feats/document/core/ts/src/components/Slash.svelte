<script lang="ts">
  import { Floating } from '@cella/org-ui'
  import { useEditor } from '../hooks/useEditor.ts'

  // The slash menu at the caret: what the block turns into, filtered by
  // what follows the `/`; the arrow keys and Enter choose, from the block.
  const ed = useEditor()
  const sl = $derived(ed.menu.slash)

  // The option the arrows reach scrolls into the menu's view, which shows
  // only so many at once.
  const shown = (i: number) => (el: HTMLElement) => {
    if (sl && i === sl.index) {
      el.scrollIntoView({ block: 'nearest' })
    }
  }
</script>

{#if sl}
  <Floating x={sl.x} y={sl.y} label="Turn into" role="listbox">
    <!-- Keyed by label and hint: two motions or meetings may share a title,
         and an embed's hint is its record's own ref. -->
    {#each ed.menu.matches as item, i (`${item.label}\u0000${item.hint}`)}
      <button role="option" aria-selected={i === sl.index} tabindex="-1" onclick={() => ed.menu.choose(item)} {@attach shown(i)}>
        <span>{item.label}</span>
        <span class="hint">{item.hint}</span>
      </button>
    {:else}
      <div class="none">No match</div>
    {/each}
  </Floating>
{/if}
