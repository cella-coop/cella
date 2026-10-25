<script lang="ts">
  import { Prose, Section } from '@cella/org-ui'
  import type { Statutes } from '../../models/split.ts'

  // What a member's work earns them, in plain words, read back from the
  // work share's terms in force: how it divides, and what of it buys
  // shares.
  let { data }: { data: Statutes | null; id: string } = $props()

  const bases = $derived(
    !data
      ? ''
      : [
          data.salary ? `${data.salary} % by pay` : '',
          data.hours ? `${data.hours} % by time worked` : '',
          data.equal ? `${data.equal} % in equal parts` : '',
        ]
          .filter(Boolean)
          .join(', '),
  )
  const text = $derived(
    !data
      ? ''
      : `Each year the assembly shares out the surplus as the law and the statutes say: the work share goes to the workers, ${bases}${data.capital ? `, and ${data.capital} % of each associate's part buys them shares, blocked five years, the rest paid` : ', paid'}. These are the patronage terms ${data.terms}, which only the assembly changes.`,
  )
</script>

{#if text}
  <Section title="What the work share pays">
    <Prose {text} />
  </Section>
{/if}
