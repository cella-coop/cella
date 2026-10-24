<script lang="ts">
  import Editable from '../Editable.svelte'
  import type { View } from '../../hooks/EditorState.svelte.ts'

  let { view }: { view: View } = $props()
</script>

<Editable id={view.id} />
