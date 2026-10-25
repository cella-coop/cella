<script lang="ts">
  import { Form } from '@cella/org-ui'
  import type { Page } from '../../models/document.ts'

  // Saving the draft as a version, in the page's header.
  let {}: { data: Page; id: string } = $props()
</script>

<Form action="version" submit="Save version" tone="quiet" inline />
