<script lang="ts">
  import { Note, Section, Table, type Column } from '@cella/org-ui'
  import type { Detail, Effect } from '../../models/motion.ts'

  // What the close carried, in its Effects tab: each effect its transaction wrote,
  // in the order logged, whether it settled or was forgone and the entry
  // it follows; under them each forgone one's reason, as its entry keeps
  // it, so an effect forgone with one it requires names the refusal it
  // follows above that refusal's own. Until it closes, or where it
  // carried none, the tab says so.
  let { data }: { data: Detail; id: string } = $props()

  const named = (e: Effect) => e.label ?? e.op
  const entries = $derived(new Map(data.effects.map((e) => [e.entry, e])))
  const follows = (e: Effect) => {
    const cause = entries.get(e.follows)
    return cause ? `${named(cause)}, entry ${cause.entry}` : `the close, entry ${e.follows}`
  }
  const forgone = $derived(data.effects.filter((e) => !e.settled))

  const columns: Column<Effect>[] = [
    { key: 'effect', label: 'Effect', value: named },
    { key: 'op', label: 'Action', kind: 'mono', value: (e) => e.op },
    { key: 'state', label: 'State', kind: 'badge', value: (e) => (e.settled ? 'settled' : 'forgone'), tone: (e) => (e.settled ? 'positive' : 'negative') },
    { key: 'follows', label: 'Follows', value: follows },
    { key: 'entry', label: 'Entry', kind: 'mono', value: (e) => e.entry },
  ]
</script>

{#if data.closed && data.effects.length}
  <Section title="Effects of the close" count={data.effects.length}>
    <Table {columns} rows={data.effects} />
    {#each forgone as e (e.id)}
      <Note text="{named(e)}, entry {e.entry}, forgone: {e.reason ?? 'its reason is not disclosed to you'}." />
    {/each}
  </Section>
{:else}
  <Section title="Effects of the close">
    <Note text={data.closed ? 'Its close carried no effects.' : 'Its effects are carried at its close.'} />
  </Section>
{/if}
