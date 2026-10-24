<script lang="ts">
  import Text from '../Text.svelte'
  import type { View } from '../../hooks/EditorState.svelte.ts'

  let { view }: { view: View } = $props()
</script>

<Text id={view.id} />
