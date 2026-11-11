<script lang="ts">
  import type { View } from '../../hooks/EditorState.svelte.ts'

  let { view }: { view: View } = $props()
</script>

<div class="divider" data-atomic={view.id}><hr /></div>
