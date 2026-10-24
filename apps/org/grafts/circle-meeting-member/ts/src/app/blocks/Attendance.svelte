<script lang="ts">
  import { Field, Form, Note, Section, Table, type Column, type Tone } from '@cella/org-ui'
  import type { Expected, OnMeeting, Status } from '../../models/roll.ts'

  // Who is expected, the circle's seats on the meeting's day, and who
  // came, guests after them. While the meeting is scheduled a member marks
  // themselves, and the minutes' keeper records anyone expected; holding
  // it fixes the marks.
  let { data }: { data: OnMeeting | null; id: string } = $props()

  const tones: Record<Status, Tone> = { present: 'positive', excused: 'neutral', absent: 'warning' }
  const statuses = [
    { value: 'present', label: 'present' },
    { value: 'excused', label: 'excused' },
    { value: 'absent', label: 'absent' },
  ]
  const columns: Column<Expected>[] = [
    { key: 'name', label: 'Member', kind: 'title', value: (e) => e.name },
    { key: 'seated', label: 'Seat', value: (e) => (e.seated ? 'seated' : 'guest') },
    { key: 'status', label: 'Attendance', kind: 'badge', value: (e) => e.status ?? 'not marked', tone: (e) => (e.status ? tones[e.status] : 'neutral') },
  ]
  const own = $derived(data?.roll.find((e) => e.member === data?.actor))
  const expected = $derived((data?.roll ?? []).filter((e) => e.seated).map((e) => ({ value: e.member, label: e.name })))
</script>

{#if data}
  <Section title="Attendance" count={data.roll.length}>
    <Table {columns} rows={data.roll} />
    {#if data.open}
      {#if data.actor}
        <Form action="attend" submit={own?.status ? 'Change my mark' : 'Mark myself'} tone="quiet" inline>
          <Field label="Me" name="status" options={statuses} value={own?.status ?? 'present'} />
        </Form>
      {/if}
      {#if data.keeps && expected.length}
        <Form action="record" submit="Record" tone="quiet" inline>
          <Field label="Member" name="member" options={expected} value={expected[0].value} />
          <Field label="Attendance" name="status" options={statuses} value="present" />
        </Form>
      {/if}
    {:else}
      <Note text="Who came is fixed." />
    {/if}
  </Section>
{/if}
