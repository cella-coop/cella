<script lang="ts">
  import { Form } from '@cella/org-ui'
  import type { Page } from '../../models/document.ts'

  // Saving the draft as a version, in the page's header; a generated
  // document is saved by no one.
  let { data }: { data: Page; id: string } = $props()
</script>

{#if !data.generated}
  <Form action="version" submit="Save version" tone="quiet" inline />
{/if}
