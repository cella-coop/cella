<script lang="ts">
  import { blocks } from '@cella/org-ui'
  import Text from '../Text.svelte'
  import type { View } from '../../hooks/EditorState.svelte.ts'

  let { view }: { view: View } = $props()
  const level = $derived((view.props.level ?? 1) as 1 | 2 | 3)
</script>

<blocks.Heading {level}>
  <Text id={view.id} placeholder="Heading {level}" />
</blocks.Heading>
