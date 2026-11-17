<script lang="ts">
  import { date, Value, Cell, Form, Hidden, icons, Note, power, Row, Inlay, Tally, type Viewer } from '@cella/org-ui'
  import { stances, type Detail, type Labelled, type Stance } from '../../models/motion.ts'

  // The motion's vote, one widget after the proposal: its state and
  // deadline, the tally so far, where it stands by its procedure, each
  // stance its method takes as a button in a row with the reader's own
  // marked, and what it decides, each action as its kind names it with
  // its arguments as chips, a policy linking to the motion that made it,
  // and each default a legal form's policy its actions leave. Closed, or
  // off its roll, the buttons give way to why. The vote itself is
  // `motion:motion:vote`, cast as the Stances tab's form casts it; this
  // never computes it.
  let { data, viewer }: { data: Detail; id: string; viewer?: Viewer | null } = $props()

  const closed = $derived(!!data.closed)
  const secret = $derived(data.ballot === 'secret')
  const options = $derived(stances[data.method])
  // The reader's own latest stance: `given` is newest first, and a
  // secret ballot's row-level security already keeps everyone else's out
  // of it until the close, so the first match is always theirs.
  const mine = $derived(viewer ? (data.given.find((g) => g.member === viewer.actor) ?? null) : null)

  // How many, of those who gave a stance, gave each: an open ballot's
  // `given` holds every member's, so the latest per member counts.
  const counts = $derived.by(() => {
    const tally = new Map(options.map((s) => [s, 0]))
    const latest = new Map<string, Stance>()
    for (const g of data.given) {
      if (!latest.has(g.member)) {
        latest.set(g.member, g.stance)
      }
    }
    for (const s of latest.values()) {
      tally.set(s, (tally.get(s) ?? 0) + 1)
    }
    return tally
  })
  const tones = { consent: 'positive', for: 'positive', object: 'negative', against: 'negative' } as const
  const bars = $derived(options.map((s) => ({ label: s, value: counts.get(s) ?? 0, tone: tones[s as keyof typeof tones] ?? 'neutral' })))

  const state = $derived(closed ? (data.tally.passes ? 'passed' : 'rejected') : 'open')
  const stateTone = $derived(state === 'passed' ? 'positive' : state === 'rejected' ? 'negative' : 'accent')
  const by = $derived(data.terms.label.toLowerCase())
  // Where it stands, as the database computes it: passing or not while
  // open, passed or rejected once closed, short of its quorum if it is.
  const outcome = $derived.by(() => {
    if (secret && !closed) {
      return 'sealed until the close'
    }
    if (data.tally.passes === null) {
      return 'no stance counts'
    }
    const verb = closed ? (data.tally.passes ? 'passed' : 'rejected') : data.tally.passes ? 'passes' : 'does not pass'
    return `${verb} by ${by}${data.tally.quorate === false ? ', short of its quorum' : ''}`
  })
  const turnout = $derived(data.tally.counted === null ? null : `${data.tally.given ?? 0} of ${data.tally.counted} stances`)

  // An action's arguments as chips: a member as their name, a policy as a
  // link to the motion that adopted it, any other by its label.
  const args = (m: Labelled) =>
    m.fields
      .filter((f) => m.args[f.name] !== undefined && m.args[f.name] !== '')
      .map((f) => {
        const v = m.args[f.name]
        if (f.name === 'member') {
          return { key: f.name, value: v, kind: 'person' as const }
        }
        if (f.name === 'policy') {
          return { key: f.name, value: v, href: `/motions/${String(v).split('/')[0]}`, record: 'motions' }
        }
        return { key: f.name, value: `${f.label}: ${f.name === 'power' ? power(v) : v}` }
      })
</script>

<Inlay name="Vote" icon={icons.Scales}>
  {#snippet aside()}
    <Value value={state} kind="badge" tone={stateTone} />
    <span>{closed ? 'Closed' : 'Closes'} {date(closed ? data.closed : data.deadline)}</span>
  {/snippet}

  {#if secret && !closed}
    <Note text="Secret ballot: {turnout ?? 'sealed until the close'} given; the tally opens at the close." />
  {:else if !closed}
    <Tally items={bars} />
  {/if}
  <Note text={[outcome, turnout].filter(Boolean).join(' · ')} />

  {#if !closed && !viewer}
    <Note text="Sign in as a member to vote." subtle />
  {:else if !closed && !data.seated}
    <Note text="You are not on this motion's roll, so you may not vote." subtle />
  {:else if !closed}
    <Row>
      {#each options as s (s)}
        <Form action="vote" submit={s} tone={mine?.stance === s ? 'primary' : 'quiet'} inline>
          <Hidden name="stance" value={s} />
        </Form>
      {/each}
    </Row>
    {#if mine}<Note text="Your stance: {mine.stance}, given {date(mine.at)}." subtle />{/if}
  {/if}

  {#each data.actions as m (m.id)}
    <Row>
      <Note text="Decides: {m.label.toLowerCase()}." subtle />
      {#each args(m) as a (a.key)}
        {#if a.href}
          <a href={a.href}><Cell value={a.value} kind={a.kind} record={a.record} /></a>
        {:else}
          <Cell value={a.value} kind={a.kind} />
        {/if}
      {/each}
    </Row>
  {/each}
  {#each data.leaves as l (l.id)}
    <Note text="Leaves the {l.form} default, by {l.action}: {l.sentence}." subtle />
  {/each}
</Inlay>
