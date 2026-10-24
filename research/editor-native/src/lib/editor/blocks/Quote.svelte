<script lang="ts">
  import Editable from '../Editable.svelte'
  import type { View } from '../../hooks/EditorState.svelte.ts'

  let { view }: { view: View } = $props()
</script>

<blockquote>
  <Editable id={view.id} placeholder="Quote" />
</blockquote>

<style>
  blockquote {
    margin: 0;
    padding-left: var(--space-3);
    border-left: 3px solid var(--text);
    font-family: var(--font-display);
    font-style: italic;
    font-size: var(--text-lg);
    display: flex;
  }
</style>
