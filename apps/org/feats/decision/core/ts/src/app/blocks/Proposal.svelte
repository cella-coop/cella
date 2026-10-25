<script lang="ts">
  import { date, Note, power, Properties, Prose, Section, type Prop } from '@cella/org-ui'
  import type { Detail, Motioned } from '../../models/decision.ts'

  // What is proposed, in full, under the rule and deadline it is decided
  // by, and each motion it decides, as its kind names it, with its
  // arguments by the kind's labels: a member as their chip, a power by
  // its plain name. The grafts that carry a motion out show it in their
  // own words below.
  let { data }: { data: Detail; id: string } = $props()

  const args = (m: Motioned): Prop[] =>
    m.fields
      .filter((f) => m.args[f.name] !== undefined && m.args[f.name] !== '')
      .map((f) => {
        const v = m.args[f.name]
        if (f.name === 'member') {
          return { label: 'Member', value: v, kind: 'person' as const }
        }
        return { label: f.label, value: f.name === 'power' ? power(v) : v, kind: f.type === 'number' ? ('number' as const) : undefined }
      })
</script>

<Section title="Proposal">
  <Note text="Deadline {date(data.deadline)}{data.closed ? `, closed ${date(data.closed)}` : ''}." />
  <Prose text={data.body.trim() || 'No proposal text.'} />
  {#each data.motions as m (m.id)}
    <Note text="Decides: {m.label.toLowerCase()}." />
    {#if args(m).length}<Properties items={args(m)} />{/if}
  {/each}
</Section>
