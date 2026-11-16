<script lang="ts">
  import { Button, Note, Section, Settings, type Declared } from '@cella/org-ui'
  import type { Amending, OnCircle } from '../../models/asking.ts'

  // A circle's Settings tab: its name, its purpose and its procedure, from
  // those in force. None saves directly, since only a motion amends a
  // circle: an edit, as it commits, opens the dialog proposing an
  // `amend-circle` motion of the circle that decides about it, prefilled
  // with what was typed. Its features are a page of their own in Settings,
  // which it links to.
  let { data }: { data: OnCircle | null; id: string } = $props()

  const amending = $derived(data?.amending)

  // A term of the circle, which the motion carries by its own name.
  const term = (a: Amending, name: 'name' | 'purpose' | 'procedure', label: string, says: (value: string, was: string) => string): Declared => ({
    name,
    label,
    value: a[name],
    refused: a.refused,
    motion: { kind: 'amend-circle', args: (value) => ({ circle: a.circle, [name]: value }), labels: { [name]: `New ${name}` }, says },
  })
  const labelled = (a: Amending, procedure: string) => a.procedures.find((p) => p.value === procedure)?.label ?? procedure

  const settings: Declared[] = $derived(
    amending
      ? [
          term(amending, 'name', 'Name', (name, was) => `Rename ${was} to ${name}`),
          { ...term(amending, 'purpose', 'Purpose', (purpose) => `Give ${amending.name} the purpose “${purpose}”`), rows: 2 },
          {
            ...term(amending, 'procedure', 'Decides by', (procedure) => `Have ${amending.name} decide by ${labelled(amending, procedure).toLowerCase()}`),
            options: amending.procedures,
          },
        ]
      : [],
  )
</script>

{#if amending}
  <Section title="Circle">
    <Settings {settings} decider={amending.decider} />
  </Section>
  <Section title="Features">
    <Note text="What {amending.name} shows in the sidebar, in its order, under its accordions, which {amending.arranger} arranges." />
    <Button href="/settings/features/{amending.circle}">Choose its features</Button>
  </Section>
  <Section title="Rules">
    <Note text="What {amending.name} sets for itself, as whether its comments take reactions, each by a rule a motion adopts." />
    <Button href="/settings/rules/{amending.circle}">See its rules</Button>
  </Section>
{/if}
