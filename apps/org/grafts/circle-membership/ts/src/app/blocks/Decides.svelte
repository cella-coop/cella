<script lang="ts">
  import { money, Prose, Section } from '@cella/org-ui'
  import type { Held, Seat } from '../../models/position.ts'

  // What a member decides, in plain words, read back from their seats and
  // the mandates those give: where they sit, how each of those circles
  // decides, and what their powers let them do, within what limit.
  let { data }: { data: { seats: Seat[]; held: Held[]; name: string }; id: string } = $props()

  const who = $derived(data.name.split(' ')[0])
  const now = $derived(data.seats.filter((s) => !s.until))
  const and = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
  const procedures: Record<Seat['procedure'], string> = {
    consent: 'by consent: a proposal passes unless a member objects',
    majority: 'by majority: a proposal passes with more for it than against',
  }
  const circles = $derived([...new Map(now.map((s) => [s.circle, s])).values()])
  const ways = $derived(
    (['consent', 'majority'] as const)
      .map((p) => ({ p, names: circles.filter((c) => c.procedure === p).map((c) => c.circleName) }))
      .filter((w) => w.names.length),
  )
  const powers = $derived([
    ...new Map(data.held.map((h) => [`${h.text}${h.limit}`, h.limit ? `${h.text}, up to ${money(h.limit)}` : h.text])).values(),
  ])
  const text = $derived(
    !now.length
      ? `${who} sits in no circle yet, so decides nothing and holds no power. The assembly seats a member when it admits them; a working circle, by its own motion.`
      : [
          `${who} sits in ${and(now.map((s, i) => `${i ? 'in ' : ''}${s.circleName}${s.roleName ? ` as ${s.roleName}` : ''}`))}.`,
          ...ways.map((w) => `${and(w.names)} ${w.names.length > 1 ? 'decide' : 'decides'} ${procedures[w.p]}.`),
          powers.length ? `Through these seats ${who} may ${powers.join('; ')}.` : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
  )
</script>

<Section title="What {who} decides">
  <Prose {text} />
</Section>
