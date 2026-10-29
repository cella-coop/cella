<script lang="ts">
  import { Form } from '@cella/org-ui'
  import type { Detail } from '../../models/bill.ts'

  // The bill's next write: someone other than its recorder approves it,
  // within their mandate's limit; finance pays it once approved. The rules
  // refuse anyone else.
  let { data }: { data: Detail; id: string } = $props()
</script>

{#if data.status === 'recorded'}
  <Form action="approve" submit="Approve" tone="primary" />
{:else if data.status === 'approved'}
  <Form action="pay" submit="Pay" tone="primary" />
{/if}
