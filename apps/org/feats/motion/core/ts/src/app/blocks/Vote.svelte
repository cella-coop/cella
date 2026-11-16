<script lang="ts">
  import { date, Form, Hidden, Note, Section, Stats, type Viewer } from '@cella/org-ui'
  import { stances, type Detail, type Stance } from '../../models/motion.ts'

  // Where and how one votes, above the proposal's own words: the motion's
  // question, as its title, each stance its method takes as a button,
  // the reader's own marked, the tally so far and the deadline, while it
  // is open and the reader may give one; closed, or off its roll, it
  // says why instead. The vote itself is `motion:motion:vote`, cast the
  // same way the Stances tab's form does; this never computes it.
  let { data, viewer }: { data: Detail; id: string; viewer?: Viewer | null } = $props()

  const closed = $derived(!!data.closed)
  const secret = $derived(data.ballot === 'secret')
  const options = $derived(stances[data.method])
  // The reader's own latest stance: `given` is newest first, and a
  // secret ballot's row-level security already keeps everyone else's out
  // of it until the close, so the first match is always theirs.
  const mine = $derived(viewer ? (data.given.find((g) => g.member === viewer.actor) ?? null) : null)

  // How many, of those who gave a stance, gave each: an open ballot's
  // `given` holds every member's, so the latest per member counts; a
  // secret one's hides them, so only the sealed turnout is shown.
  const counts = $derived.by(() => {
    const tally = new Map(options.map((s) => [s, 0]))
    if (secret) {
      return tally
    }
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

  const turnout = $derived(data.tally.counted === null ? 'sealed until the close' : `${data.tally.given ?? 0} of ${data.tally.counted}`)
  const outcome = $derived(data.tally.passes === null ? 'no stance counts' : data.tally.passes ? 'passed' : 'rejected')
</script>

<Section title={data.title}>
  {#if closed}
    <Note text="Closed on {date(data.closed)}: {outcome}, {turnout}." />
  {:else if !viewer}
    <Note text="Sign in as a member to vote. Closes {date(data.deadline)}." />
  {:else if !data.seated}
    <Note text="You are not on this motion's roll, so you may not vote. Closes {date(data.deadline)}." />
  {:else}
    {#each options as s (s)}
      <Form action="vote" submit={s} tone={mine?.stance === s ? 'primary' : 'quiet'} inline>
        <Hidden name="stance" value={s} />
      </Form>
    {/each}
    {#if mine}<Note text="Your stance: {mine.stance}, given {date(mine.at)}." />{/if}
    <Note text="Closes {date(data.deadline)}." />
  {/if}
  {#if secret}
    <Note text="Secret ballot: {turnout} given; the tally opens at the close." subtle />
  {:else}
    <Stats items={options.map((s) => ({ label: s, value: counts.get(s) ?? 0, kind: 'number' }))} />
  {/if}
</Section>
