<script lang="ts">
  import type { Component } from 'svelte'
  import { Cell, date, Form, Hidden, icons, Note, Panel, power, Row, Tally, type Tone, type Viewer } from '@cella/org-ui'
  import { stances, type Detail, type Labelled, type Stance } from '../../models/motion.ts'

  // The motion's vote, one panel after the proposal: its state and
  // deadline at its head, the tally so far, where it stands by its
  // procedure, and what it decides, each action as its kind names it with
  // its arguments as chips, a policy linking to the motion that made it,
  // and each default a legal form's policy its actions leave. Its footer
  // holds the stances its method takes, one run at its right end, each
  // in its own tone with its icon, and on its left the reader's own
  // stance; closed, or off its roll, the buttons give way to why. The
  // vote itself is `motion:motion:vote`, cast as the Stances tab's form
  // casts it; this never computes it.
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

  // Each stance's button: an affirmative one positive with a check, an
  // objection a refusal's tone with a raised hand, an abstention quiet;
  // once the reader has given one, the others step back to quiet.
  const looks: Record<string, { tone: 'positive' | 'danger' | 'quiet'; lead: Component<any> }> = {
    consent: { tone: 'positive', lead: icons.Check },
    for: { tone: 'positive', lead: icons.Check },
    object: { tone: 'danger', lead: icons.Hand },
    against: { tone: 'danger', lead: icons.Hand },
    abstain: { tone: 'quiet', lead: icons.Minus },
  }
  const tone = (s: Stance) => (mine && mine.stance !== s ? 'quiet' : (looks[s]?.tone ?? 'quiet'))
  const word = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}`

  const state = $derived(closed ? (data.tally.passes ? 'passed' : 'rejected') : 'open')
  const stateTone: Tone = $derived(state === 'passed' ? 'positive' : state === 'rejected' ? 'negative' : 'accent')
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
  const votes = $derived(!closed && !!viewer && !!data.seated)

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

{#snippet why()}
  {#if closed}
    The vote is closed.
  {:else if !viewer}
    Sign in as a member to vote.
  {:else if !data.seated}
    You are not on this motion's roll, so you may not vote.
  {:else if mine}
    Your stance: {mine.stance}, given {date(mine.at)}.
  {:else}
    You have given no stance yet.
  {/if}
{/snippet}

{#snippet cast()}
  {#each options as s (s)}
    <Form action="vote" button submit={word(s)} tone={tone(s)} lead={looks[s]?.lead}>
      <Hidden name="stance" value={s} />
    </Form>
  {/each}
{/snippet}

<Panel
  title="Vote"
  icon={icons.Scales}
  status={{ label: state, tone: stateTone }}
  meta="{closed ? 'Closed' : 'Closes'} {date(closed ? data.closed : data.deadline)}"
  help={why}
  actions={votes ? cast : undefined}
>
  {#if secret && !closed}
    <Note text="Secret ballot: {turnout ?? 'sealed until the close'} given; the tally opens at the close." />
  {:else if !closed}
    <Tally items={bars} of={data.tally.counted ?? undefined} />
  {/if}
  <Note text={[outcome, turnout].filter(Boolean).join(' · ')} />

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
</Panel>
