<script lang="ts">
  import { blocks } from '@cella/org-ui'
  import type { View } from '../../hooks/EditorState.svelte.ts'

  let { view }: { view: View } = $props()
</script>

<blocks.Divider data-atomic={view.id} />
