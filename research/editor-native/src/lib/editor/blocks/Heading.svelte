<script lang="ts">
  import Editable from '../Editable.svelte'
  import type { View } from '../../hooks/EditorState.svelte.ts'

  let { view }: { view: View } = $props()
  const level = $derived(view.props.level ?? 1)
</script>

<div class="heading l{level}" role="heading" aria-level={level}>
  <Editable id={view.id} placeholder="Heading {level}" />
</div>

<style>
  .heading {
    font-family: var(--font-display);
    font-weight: 500;
    line-height: 1.25;
    display: flex;
  }

  .l1 {
    font-size: var(--text-2xl);
    margin-top: var(--space-3);
  }

  .l2 {
    font-size: var(--text-xl);
    margin-top: var(--space-3);
  }

  .l3 {
    font-size: var(--text-lg);
    margin-top: var(--space-2);
  }
</style>
