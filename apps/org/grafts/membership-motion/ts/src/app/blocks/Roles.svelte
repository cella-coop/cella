<script lang="ts">
  import { Section, Settings, type Declared } from '@cella/org-ui'
  import type { Duty, OnCircle } from '../../models/asking.ts'

  // The roles on a circle's Settings tab, below its terms: each its name,
  // duty and cap, and a row to make a new one. None saves directly, since
  // only a motion makes or changes a role: Save opens the dialog proposing
  // an `amend-role` or `role` motion of the circle that decides about it,
  // prefilled with what was typed.
  let { data }: { data: OnCircle | null; id: string } = $props()

  const amending = $derived(data?.amending)

  type Term = 'name' | 'duty' | 'holders'
  const labels: Record<Term, string> = { name: 'Name', duty: 'Duty', holders: 'Cap' }
  const shape = (name: Term, s: Declared): Declared => (name === 'holders' ? { ...s, type: 'number' } : name === 'duty' ? { ...s, rows: 2 } : s)

  // A term of a role, which the motion carries by its own name.
  const term = (r: Duty, name: Term, says: (value: string, was: string) => string): Declared =>
    shape(name, {
      name,
      label: labels[name],
      value: r[name],
      refused: r.refused,
      motion: { kind: 'amend-role', args: (value) => ({ role: r.role, [name]: value }), labels: { [name]: `New ${labels[name].toLowerCase()}` }, says },
    })

  // A new role's id, from the name typed: in lower case, as `editor`.
  const id = (name: string) =>
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^[^a-z]+|-+$/g, '')

  // A term of the new role, which a `role` motion makes in this circle.
  const fresh = (circle: string, refused: string, name: Term, says: (value: string) => string): Declared =>
    shape(name, {
      name,
      label: labels[name],
      value: '',
      refused,
      motion: {
        kind: 'role',
        args: (value) => ({ circle, ...(name === 'name' ? { id: id(value) } : {}), [name]: value }),
        labels: name === 'name' ? { id: 'Id', name: 'Name' } : { [name]: labels[name] },
        says,
      },
    })

  const made = $derived(
    amending
      ? [
          fresh(amending.circle, amending.making, 'name', (name) => `Make the ${name} role in ${amending.name}`),
          fresh(amending.circle, amending.making, 'duty', (duty) => `its duty: ${duty}`),
          fresh(amending.circle, amending.making, 'holders', (cap) => `held by ${cap} at most`),
        ]
      : [],
  )
</script>

{#if amending}
  {#each amending.roles as r (r.role)}
    <Section title={r.circle === '*' ? `${r.name}, in every working circle` : r.name}>
      <Settings
        settings={[
          term(r, 'name', (name, was) => `Rename the ${was} role to ${name}`),
          term(r, 'duty', () => `Give the ${r.name} role a new duty`),
          term(r, 'holders', (cap, was) => (cap ? `Cap the ${r.name} role at ${cap}` : `Lift the ${r.name} role's cap of ${was}`)),
        ]}
        decider={r.decider}
      />
    </Section>
  {/each}
  <Section title="New role">
    <Settings settings={made} decider={amending.decider} />
  </Section>
{/if}
