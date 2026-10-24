<script lang="ts">
  import { date, Note, Prose, Section } from '@cella/org-ui'
  import type { Detail } from '../../models/decision.ts'

  // What is proposed, in full, under the rule and deadline it is decided
  // by, and each motion it decides, as its kind names it; the grafts that
  // carry a motion out show it in their own words below.
  let { data }: { data: Detail; id: string } = $props()

  const args = (a: Record<string, string | number>) =>
    Object.entries(a)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')
</script>

<Section title="Proposal">
  <Note text="Deadline {date(data.deadline)}{data.closed ? `, closed ${date(data.closed)}` : ''}." />
  <Prose text={data.body.trim() || 'No proposal text.'} />
  {#each data.motions as m (m.id)}
    <Note text="Decides: {m.label.toLowerCase()}{Object.keys(m.args).length ? ` (${args(m.args)})` : ''}." />
  {/each}
</Section>
