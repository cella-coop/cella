<script lang="ts">
  import { Form } from '@cella/org-ui'
  import type { Posted } from '../../models/posted.ts'

  // Distributing the split the assembly approved: it posts it to the
  // books, and credits the shares the work share buys, once. It needs
  // distribute-surplus, which finance holds.
  let { data }: { data: Posted; id: string } = $props()
</script>

{#if data.approved && !data.distributed}
  <Form action="distribute" submit="Distribute" tone="primary" />
{/if}
