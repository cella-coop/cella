<script lang="ts">
  import { Field, Note } from '@cella/org-ui'
  import { usePut } from '../../hooks/usePut.ts'

  // What a grant or a change grants, as typed: the power and what it
  // grants in words, its cap, a limit per write or a budget over a month
  // or a year, the circle it covers, and its days; then the sentence the
  // policy will read. A circle's Propose… and a mandate's Change… share it.
  let { circles }: { circles: { id: string; name: string }[] } = $props()

  const state = usePut()
  const scopes = $derived([{ value: 'own', label: 'its own circle' }, ...circles.map((c) => ({ value: c.id, label: c.name }))])
  const pers = [
    { value: 'month', label: 'a month' },
    { value: 'year', label: 'a year' },
  ]
</script>

<Field label="Power" name="arg.power" placeholder="approve-time" required bind:value={state.power} />
<Field label="Grants" name="arg.text" placeholder="approve timesheets" wide bind:value={state.text} />
<Field label="Limit per write, €" name="arg.limit" type="number" bind:value={state.limit} />
<Field label="Budget, €" name="arg.budget" type="number" bind:value={state.budget} />
<Field label="Budget per" name="arg.per" options={pers} placeholder="—" bind:value={state.per} />
<Field label="Covers" name="arg.scope" options={scopes} placeholder="the whole coop" bind:value={state.scope} />
<Field label="From" name="arg.from" type="date" bind:value={state.from} />
<Field label="Until" name="arg.until" type="date" bind:value={state.until} />
{#if state.sentence}<Note text="It will read: {state.sentence}." />{/if}
