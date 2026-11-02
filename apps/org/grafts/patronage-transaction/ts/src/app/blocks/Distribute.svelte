<script lang="ts">
  import { Field, Form } from '@cella/org-ui'
  import type { Posted } from '../../models/posted.ts'

  // Distributing the split the assembly approved, where the posting that
  // follows the approval was refused, as when its month was not open: it
  // posts it to the books, once, citing the motion that approved it, and
  // the credits of the shares the work share buys follow it.
  let { data }: { data: Posted; id: string } = $props()
</script>

{#if data.approved && !data.distributed}
  <Form action="distribute" submit="Distribute" tone="primary" inline>
    <Field label="Decided by" name="motion" />
  </Form>
{/if}
