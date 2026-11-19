<script lang="ts">
  import { Form } from '@cella/org-ui'
  import type { Detail } from '../../models/meeting.ts'

  // Holding a scheduled meeting, which fixes its agenda and who came, or
  // cancelling it; whichever settles first stands.
  let { data }: { data: Detail; id: string } = $props()
</script>

{#if data.status === 'scheduled'}
  <Form action="cancel" button submit="Cancel" tone="danger" />
  <Form action="hold" button submit="Hold" />
{/if}
