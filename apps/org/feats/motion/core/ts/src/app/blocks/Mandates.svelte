<script lang="ts">
  import { Note, power, Properties, Section, type Prop } from '@cella/org-ui'
  import type { Issuing, Mandate } from '../../models/circles.ts'

  // What the motion's actions do to the mandates: for each grant, the
  // parent it is issued under, or would be were it closed at its
  // deadline, and while it is open what is wrong with it; for each end or
  // replacement of a mandate's policy, every mandate its close revokes the
  // same day; once closed, each mandate granted or revoked. Each links to
  // the circle whose page lists it.
  let { data }: { data: { mandates: Issuing[] } | null; id: string } = $props()

  const named = (m: Mandate) => `${power(m.power)}, ${m.grantee}, ${m.cap}, issued by ${m.issuer}`
  const row = (label: string, m: Mandate): Prop => ({ label, value: named(m), href: `/circles/${m.circle}` })
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

  const shown = (i: Issuing): Prop[] => [
    ...(i.granted ? [row('Granted', i.granted)] : []),
    ...(i.parent ? [row(i.closed ? 'Issued under' : 'Would be issued under', i.parent)] : []),
    ...(i.ends ? [row(i.kind === 'end' ? 'Ends' : 'Replaces', i.ends)] : []),
    ...i.revokes.filter((m) => m.id !== i.ends?.id).map((m) => row('Revoked with it', m)),
  ]
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
