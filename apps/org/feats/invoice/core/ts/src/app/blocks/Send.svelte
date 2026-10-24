<script lang="ts">
  import { Form } from '@cella/org-ui'
  import type { Detail } from '../../models/invoice.ts'

  // Marks the invoice sent on the verdict date; a voided one is not sent.
  let { data }: { data: Detail; id: string } = $props()
</script>

{#if !data.sent && !data.voided}
  <Form action="send" submit="Mark sent" tone="quiet" />
{/if}
