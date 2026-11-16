<script lang="ts">
  import { Diff, Section } from '@cella/org-ui'
  import type { Roll } from '../../models/roll.ts'

  // What a motion's actions change, on its Overview and its Effects: each
  // change of a kind this graft carries out as its diff, the slot a kind
  // of action fills with its own view of the change. A circle's features
  // as their tree with what is added, moved or reordered marked; a term
  // of a circle or a role from the value it replaces, struck through, to
  // the new. Open, it changes them from the values in force; closed, from
  // those its effects replaced.
  let { data }: { data: Roll | null; id: string } = $props()

  const shown = $derived(data?.changes ?? [])
</script>

{#if shown.length}
  <Section title={data?.closed ? 'What it changed' : 'What it changes'}>
    {#each shown as c (c.key)}
      <Diff shape={c.shape} label={c.label} was={c.was} value={c.value} />
    {/each}
  </Section>
{/if}
