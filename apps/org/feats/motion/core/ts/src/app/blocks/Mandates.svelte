<script lang="ts">
  import { Note, power, Properties, Section, type Prop } from '@cella/org-ui'
  import { cap } from '@cella/org-circle/bindings'
  import type { Issuing, Mandate } from '../../models/circles.ts'

  // What the motion's actions do to the mandates: for each grant, the
  // parent it is issued under, or would be were it closed at its
  // deadline, and while it is open what is wrong with it; for each end or
  // replacement of a mandate's policy, every mandate its close revokes the
  // same day; once closed, each mandate granted or revoked. Each names its
  // grantee and issuer by name and its cap as a mandate's page says it,
  // and opens its own page, its chain.
  let { data }: { data: { mandates: Issuing[] } | null; id: string } = $props()

  const named = (m: Mandate) => `${power(m.power)}, ${m.grantee}, ${cap(m)}, issued by ${m.issuer}`
  const row = (label: string, m: Mandate): Prop => ({ label, value: named(m), href: `/mandates/${m.id}` })
  const many = (n: number) => (n === 1 ? 'one mandate' : `${n} mandates`)

  // What the action does, in a sentence.
  function says(i: Issuing): string {
    const grant =
      i.kind !== 'policy'
        ? ''
        : i.closed
          ? i.granted
            ? 'granted a mandate'
            : 'granted no mandate'
          : i.parent
            ? 'grants a mandate under the one its issuer holds'
            : 'grants a mandate the assembly issues, a root'
    const end = !i.ends
      ? ''
      : i.revokes.length === 0
        ? `${i.closed ? 'revoked' : 'revokes'} nothing, the mandate it ${i.kind === 'end' ? 'ends' : 'replaces'} standing no longer`
        : `${i.closed ? 'revoked' : 'revokes'} ${many(i.revokes.length)} the same day, the one it ${i.kind === 'end' ? 'ends' : 'replaces'} and every one issued under it`
    return `Action ${i.n} ${[grant, end].filter(Boolean).join(', and ')}.`
  }

  // Every other mandate a close revokes with the one it ends or
  // replaces: each its own row, since a Properties list keys a row by
  // its label, which stays "Revoked with it" alone where there is only
  // one, and is numbered where a cascade revokes several, so no two
  // rows of the same action ever share a label.
  const shown = (i: Issuing): Prop[] => {
    const revoked = i.revokes.filter((m) => m.id !== i.ends?.id)
    return [
      ...(i.granted ? [row('Granted', i.granted)] : []),
      ...(i.parent ? [row(i.closed ? 'Issued under' : 'Would be issued under', i.parent)] : []),
      ...(i.ends ? [row(i.kind === 'end' ? 'Ends' : 'Replaces', i.ends)] : []),
      ...revoked.map((m, n) => row(revoked.length > 1 ? `Revoked with it (${n + 1} of ${revoked.length})` : 'Revoked with it', m)),
    ]
  }
</script>

{#if data?.mandates.length}
  <Section title="Mandates">
    {#each data.mandates as i (i.n)}
      <Note text={says(i)} />
      {#if i.flaw}<Note text="As it stands it would be refused: {i.flaw}." />{/if}
      {#if shown(i).length}<Properties items={shown(i)} />{/if}
    {/each}
  </Section>
{/if}
