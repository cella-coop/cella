<script lang="ts">
  import Text from '../Text.svelte'
  import type { View } from '../../hooks/EditorState.svelte.ts'

  let { view }: { view: View } = $props()
  const level = $derived(view.props.level ?? 1)
</script>

<div class="heading" data-level={level} role="heading" aria-level={level + 1}>
  <Text id={view.id} placeholder="Heading {level}" />
</div>
