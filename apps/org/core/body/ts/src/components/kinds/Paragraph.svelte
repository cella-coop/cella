<script lang="ts">
  import { blocks } from '@cella/org-ui'
  import Text from '../Text.svelte'
  import type { View } from '../../hooks/EditorState.svelte.ts'

  let { view }: { view: View } = $props()
</script>

<blocks.Paragraph>
  <Text id={view.id} />
</blocks.Paragraph>
