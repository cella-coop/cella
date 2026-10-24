<script lang="ts">
  import { Field, Form, Section, Stats, Table, type Column, type Tone } from '@cella/org-ui'
  import { stances } from '@cella/org-decision/models'
  import { outcome, type Roll, type Voter } from '../../models/roll.ts'

  // Who may vote, each one's latest stance before the cutoff, the outcome
  // computed from them, and, while the decision is open, a stance as the
  // acting member, which `on_roll` refuses for anyone off the roll.
  let { data }: { data: Roll; id: string } = $props()

  const options = $derived(stances[data.rule].map((s) => ({ value: s, label: s })))
  const tones: Record<string, Tone> = { consent: 'positive', for: 'positive', object: 'negative', against: 'negative', abstain: 'neutral' }
  const columns: Column<Voter>[] = [
    { key: 'name', label: 'Member', kind: 'title', value: (v) => v.name ?? v.member },
    { key: 'stance', label: 'Latest stance', kind: 'badge', value: (v) => v.stance ?? 'none yet', tone: (v) => (v.stance ? tones[v.stance] : 'neutral') },
    { key: 'receipt', label: 'Receipt', kind: 'number', value: (v) => v.receipt },
    { key: 'counted', label: 'Counted', value: (v) => (data.closed ? (v.counted ? 'yes' : 'no') : 'at the close') },
  ]
  const given = $derived(data.voters.filter((v) => v.stance).length)
</script>

<Stats
  items={[
    { label: 'Outcome', value: outcome(data).text, kind: 'badge', tone: outcome(data).tone },
    { label: 'Stances', value: `${given} of ${data.voters.length}` },
    { label: 'Rule', value: data.rule },
  ]}
/>

{#if !data.closed}
  <Section title="Your stance">
    <Form action="vote" submit="Cast stance" inline>
      <Field label="Stance" name="stance" options={options} />
    </Form>
  </Section>
{/if}

<Section title="Roll" count={data.voters.length}>
  <Table {columns} rows={data.voters} empty="No voters"href={(v: Voter) => `/members/${v.member}`} />
</Section>
