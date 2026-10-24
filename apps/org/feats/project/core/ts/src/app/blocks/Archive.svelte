<script lang="ts">
  import { Form } from '@cella/org-ui'
  import type { Detail } from '../../models/project.ts'

  // Archiving hides the project and freezes it; it stays for the books.
  let { data }: { data: Detail; id: string } = $props()
</script>

{#if !data.archived}
  <Form action="archive" submit="Archive" tone="quiet" />
{/if}
