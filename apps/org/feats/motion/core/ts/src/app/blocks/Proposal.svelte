<script lang="ts">
  import { date, Note, power, Properties, Prose, Section, type Prop } from '@cella/org-ui'
  import type { Detail, Labelled } from '../../models/motion.ts'

  // What is proposed, in full, under the method and deadline it is decided
  // by, and each action it decides, as its kind names it, with its
  // arguments by the kind's labels: a member as their chip, a power by
  // its plain name; and each default policy of a legal form its actions
  // leave, with the action that leaves it. The grafts that carry an action
  // out show it in their own words below.
  let { data }: { data: Detail; id: string } = $props()

  const args = (m: Labelled): Prop[] =>
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
  {#each data.actions as m (m.id)}
    <Note text="Decides: {m.label.toLowerCase()}." />
    {#if args(m).length}<Properties items={args(m)} />{/if}
  {/each}
  {#each data.leaves as l (l.id)}
    <Note text="Leaves the {l.form} default, by {l.action}: {l.sentence}." />
  {/each}
</Section>
