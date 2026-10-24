<script lang="ts">
  import { Prose, Section } from '@cella/org-ui'
  import type { Detail } from '../../models/decision.ts'

  let { data }: { data: Detail; id: string } = $props()
</script>

<Section title="Proposal">
  <Prose text={data.body.trim() || 'No proposal text.'} />
</Section>
