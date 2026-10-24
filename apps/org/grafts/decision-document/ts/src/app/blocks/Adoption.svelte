<script lang="ts">
  import { Properties, Section, short, type Embed } from '@cella/org-ui'
  import { Reader } from '@cella/org-document/app'
  import type { OnDecision } from '../../models/adoption.ts'
  import Card from './Card.svelte'

  // The document version a decision asks to adopt, in full: read from the
  // version's canonical form, which the database computed from its
  // snapshot, with its hash, which the decision names, and the version it
  // would replace.
  let { data }: { data: OnDecision; id: string } = $props()

  const decision: Embed<OnDecision> = { label: 'Decision', block: Card }
  const embeds = $derived({ decision: { embed: decision, data } })
</script>

{#each data.adopting as a (a.id)}
  <Section title="Adopts {a.name}">
    <Properties
      items={[
        { label: 'Version', value: a.version, kind: 'mono', href: `/documents/${a.document}` },
        { label: 'Hash', value: short(a.hash, 16), kind: 'mono' },
        a.adopted
          ? { label: 'Adopted', value: a.adopted, kind: 'date' }
          : a.current
            ? { label: 'Replaces', value: `@${a.current.split('@')[1]}`, kind: 'mono', href: `/documents/${a.document}` }
            : { label: 'Replaces', value: 'nothing adopted yet' },
      ]}
    />
    <Reader canon={a.canonical} label="{a.name}, {a.version}" {embeds} />
  </Section>
{/each}
