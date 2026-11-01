<script lang="ts">
  import { Form } from '@cella/org-ui'
  import type { Detail } from '../../models/motion.ts'

  // Closing fixes which stances made it. `motion.closes` refuses it
  // before the deadline; a member not seated in the circle is refused too.
  let { data }: { data: Detail; id: string } = $props()
</script>

{#if !data.closed}
  <Form action="close" submit="Close motion" tone="quiet" />
{/if}
