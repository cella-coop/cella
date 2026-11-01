<script lang="ts">
  import { Properties, Section, short, type Embed } from '@cella/org-ui'
  import { Reader } from '@cella/org-document/app'
  import type { OnMotion } from '../../models/adoption.ts'
  import { Card } from '@cella/org-motion/app'

  // The document version a motion asks to adopt, in full: read from the
  // version's canonical form, which the database computed from its
  // snapshot, with its hash, which the motion names, and the version it
  // would replace.
  let { data }: { data: OnMotion; id: string } = $props()

  const motion: Embed<OnMotion> = { label: 'Motion', block: Card }
  const embeds = $derived({ motion: { embed: motion, data } })
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
