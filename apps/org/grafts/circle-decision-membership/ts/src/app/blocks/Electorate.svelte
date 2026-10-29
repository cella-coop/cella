<script lang="ts">
  import { date, Field, Form, Note, Section, Table, type Column, type Tone } from '@cella/org-ui'
  import type { Roll, Voter } from '../../models/roll.ts'
  import { useStance } from '../../hooks/useStance.ts'

  // Who may vote and each one's latest stance before the cutoff, none on a
  // secret ballot, and the acting member's own stance as the server read
  // it: on the roll and open, the form to give or change it; closed, the
  // stance that counted; off the roll, a line saying so.
  let { data }: { data: Roll; id: string } = $props()

  const mine = $derived(data.me?.stance ?? null)
  const state = useStance(() => mine?.stance ?? '')
  const options = $derived(data.stances.map((s) => ({ value: s, label: s })))
  const tones: Record<string, Tone> = { consent: 'positive', for: 'positive', object: 'negative', against: 'negative', abstain: 'neutral' }
  const member: Column<Voter> = { key: 'member', label: 'Member', kind: 'person', value: (v) => v.member }
  const counted: Column<Voter> = { key: 'counted', label: 'Counted', value: (v) => (data.closed ? (v.counted ? 'yes' : 'no') : 'at the close') }
  const columns: Column<Voter>[] = $derived(
    data.secret
      ? [member, counted]
      : [
          member,
          { key: 'stance', label: 'Latest stance', kind: 'badge', value: (v) => v.stance ?? 'none yet', tone: (v) => (v.stance ? tones[v.stance] : 'neutral') },
          { key: 'receipt', label: 'Receipt', kind: 'number', value: (v) => v.receipt },
          counted,
        ],
  )
  const said = $derived(mine ? `${mine.stance} · receipt ${mine.receipt} · ${date(mine.at)}` : '')
</script>

<Section title="Your stance">
  {#if !data.me}
    <Note text="Sign in as a member to give a stance." />
  {:else if !data.me.seated}
    <Note text="Not on this decision's roll." />
  {:else if data.closed}
    <Note text={mine ? `Counted: ${said}.` : 'You gave no stance before the close.'} />
  {:else}
    {#if mine}<Note text="Now: {said}." />{/if}
    <Form action="vote" submit={mine ? 'Change stance' : 'Cast stance'} inline reset={false} ready={state.changed}>
      <Field label="Stance" name="stance" {options} placeholder="Choose…" bind:value={state.chosen} required />
    </Form>
  {/if}
</Section>

<Section title="Roll" count={data.voters.length}>
  {#if data.secret}<Note text="Secret ballot: each stance is its member's alone, and the tally opens at the close." />{/if}
  <Table {columns} rows={data.voters} empty="No voters" href={(v: Voter) => `/people/${v.member}`} />
</Section>
