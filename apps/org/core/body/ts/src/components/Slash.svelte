<script lang="ts">
  import { CaretMenu } from '@cella/org-ui'
  import { useEditor } from '../hooks/useEditor.ts'
  import type { Item } from '../hooks/MenuState.svelte.ts'

  // The slash menu at the caret: what the block turns into, filtered by
  // what follows the `/`; the arrow keys and Enter choose, from the block.
  const ed = useEditor()
  const sl = $derived(ed.menu.slash)
</script>

{#if sl}
  <CaretMenu x={sl.x} y={sl.y} above={sl.above} label="Turn into" items={ed.menu.matches} active={sl.index} onchoose={(i) => ed.menu.choose(ed.menu.matches[i])}>
    <!-- Two motions or meetings may share a title, and an embed's hint
         is its record's own ref; the menu keys its items itself. -->
    {#snippet item(it)}
      {const i = $derived(it as Item)}
      <span>{i.label}</span>
      <span class="hint">{i.hint}</span>
    {/snippet}
  </CaretMenu>
{/if}
