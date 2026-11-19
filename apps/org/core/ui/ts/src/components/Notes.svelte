<script lang="ts">
  import type { Snippet } from 'svelte'
  import Notebook from 'phosphor-svelte/lib/Notebook'
  import Plus from 'phosphor-svelte/lib/Plus'
  import Button from './Button.svelte'
  import Panel from './Panel.svelte'
  import { useNotes } from '../hooks/useNotes.ts'

  // A record's body where its page opens on its panels: the last panel,
  // Notes, once someone has written, the editor. While the body holds
  // nothing there is nothing to head: no panel and no heading, only a
  // quiet "Add a note" at the column's inset, which opens the editor.
  // `record` names the record, so a page reused for the next one starts
  // shut.
  let { record, blank, children }: { record: string; blank: boolean; children: Snippet } = $props()

  const notes = useNotes()
</script>

{#if notes.shows(record, blank)}
  <Panel title="Notes" icon={Notebook}>
    {@render children()}
  </Panel>
{:else}
  <div class="add">
    <Button tone="subtle" lead={Plus} onclick={() => notes.open(record)}>Add a note</Button>
  </div>
{/if}

<style>
  /* The affordance alone, its words on the column's edge as a panel's
     title would be. */
  .add {
    display: flex;
    padding-inline: calc(var(--inset, 0) - var(--space-3) - 1px);
  }
</style>
