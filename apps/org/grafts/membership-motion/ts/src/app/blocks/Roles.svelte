<script lang="ts">
  import { Compose, Section, Settings, type Composed, type Declared } from '@cella/org-ui'
  import type { Duty, OnCircle } from '../../models/asking.ts'

  // The roles on a circle's Settings tab, below its terms: each its name,
  // duty and cap, and Add a role… to make a new one. None saves directly,
  // since only a motion makes or changes a role: a term's edit, as it
  // commits, opens the dialog proposing an `amend-role` motion of the
  // circle that decides about it, prefilled with what was typed; a new
  // role is composed whole in a dialog, its name, duty and cap, and
  // proposed as one `role` motion, its id taken from its name as it is
  // made.
  let { data }: { data: OnCircle | null; id: string } = $props()

  const amending = $derived(data?.amending)

  type Term = 'name' | 'duty' | 'holders'
  const labels: Record<Term, string> = { name: 'Name', duty: 'Duty', holders: 'Cap' }
  const shape = (name: Term, s: Declared): Declared => (name === 'holders' ? { ...s, type: 'number' } : name === 'duty' ? { ...s, rows: 2 } : s)

  // A term of a role, which the motion carries by its own name; a cap
  // emptied is given as none, which lifts it.
  const term = (r: Duty, name: Term, says: (value: string, was: string) => string): Declared =>
    shape(name, {
      name,
      label: labels[name],
      value: r[name],
      refused: r.refused,
      motion: {
        kind: 'amend-role',
        args: (value) => ({ role: r.role, [name]: name === 'holders' && !value.trim() ? 'none' : value }),
        labels: { [name]: `New ${labels[name].toLowerCase()}` },
        says,
      },
    })

  // The new role's terms, which one `role` motion makes in this circle;
  // no id, which the make takes from its name.
  const fresh: Composed[] = [
    { name: 'name', label: 'Name' },
    { name: 'duty', label: 'Duty', rows: 2 },
    { name: 'holders', label: 'Cap', type: 'number' },
  ]
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
  <Compose
    label="Add a role…"
    title="New role in {amending.name}"
    decider={amending.decider}
    kind="role"
    fields={fresh}
    args={{ circle: amending.circle }}
    says={(v) => `Make the ${v.name} role in ${amending.name}`}
    why={amending.making}
  />
{/if}
