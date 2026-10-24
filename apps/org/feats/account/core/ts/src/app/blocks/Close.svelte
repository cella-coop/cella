<script lang="ts">
  import { Form } from '@cella/org-ui'
  import type { Period } from '../../models/account.ts'

  // Closing a month is ordered: a post into it waits for the close or is
  // refused after it. It needs close-period, which finance holds.
  let { data }: { data: Period; id: string } = $props()
</script>

{#if !data.closed}
  <Form action="close" submit="Close the month" tone="quiet" />
{/if}
