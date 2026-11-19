<script lang="ts">
  import { date, power, Section, Table, type Column } from '@cella/org-ui'
  import { cap } from '@cella/org-circle/bindings'
  import type { Power } from '../../models/power.ts'

  // What a person may do on the verdict date, power by power, and what
  // through: the circle, the role, the tenure that holds it and the
  // mandate, with its caps and scope, each line opening the mandate and its
  // chain; or the right the form gives them. A power held twice is listed
  // twice, one line each.
  let { data }: { data: { powers: Power[] }; id: string } = $props()

  const rights = { person: "every person's right", member: "every member's right", employee: "every employee's right" }
  const term = (p: Power) =>
    p.right
      ? null
      : p.tenure === null
        ? 'its seat'
        : p.since && p.until
          ? `${date(p.since)} – ${date(p.until)}`
          : p.since
            ? `since ${date(p.since)}`
            : p.until
              ? `until ${date(p.until)}`
              : 'open-ended'
  // A budget is shown, and said to be unchecked: no guard tracks the
  // spend over its period yet.
  const capped = (p: Power) => (p.budget !== null ? `${cap(p).replace(/^within /, '')}, unchecked` : cap(p).replace(/^up to /, ''))
  const reach = (p: Power) =>
    p.right ? 'their own' : p.scope === null ? 'the whole coop' : p.scope === 'own' ? `${p.circleName}, its own` : (p.scopeName ?? p.scope)

  const columns: Column<Power>[] = [
    { key: 'power', label: 'Power', kind: 'title', value: (p) => power(p.power) },
    { key: 'through', label: 'Through', value: (p) => (p.right ? rights[p.right] : p.roleName ? `${p.roleName} in ${p.circleName}` : `seat in ${p.circleName}`) },
    { key: 'tenure', label: 'Held', value: (p) => term(p) },
    { key: 'cap', label: 'Cap', value: (p) => capped(p) },
    { key: 'covers', label: 'Covers', value: (p) => reach(p) },
  ]
  const count = $derived(new Set(data.powers.map((p) => p.power)).size)
</script>

<Section title="Powers" {count}>
  <Table {columns} rows={data.powers} href={(p: Power) => (p.mandate ? `/mandates/${p.mandate}` : undefined)} empty="No power you may read on this day" />
</Section>
