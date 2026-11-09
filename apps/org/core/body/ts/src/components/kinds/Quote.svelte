<script lang="ts">
  import Text from '../Text.svelte'
  import type { View } from '../../hooks/EditorState.svelte.ts'

  let { view }: { view: View } = $props()
</script>

<blockquote class="quote">
  <Text id={view.id} placeholder="Quote" />
</blockquote>
