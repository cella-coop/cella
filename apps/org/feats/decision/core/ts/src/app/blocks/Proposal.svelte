<script lang="ts">
  import { date, Note, Prose, Section } from '@cella/org-ui'
  import type { Detail } from '../../models/decision.ts'

  // What is proposed, in full, under the rule and deadline it is decided by.
  let { data }: { data: Detail; id: string } = $props()
</script>

<Section title="Proposal">
  <Note text="Deadline {date(data.deadline)}{data.closed ? `, closed ${date(data.closed)}` : ''}." />
  <Prose text={data.body.trim() || 'No proposal text.'} />
</Section>
