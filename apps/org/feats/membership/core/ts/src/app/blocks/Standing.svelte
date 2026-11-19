<script lang="ts">
  import { Button, date, icons, Panel, Prose, type Tone } from '@cella/org-ui'
  import type { Membership, Status } from '../../models/member.ts'

  // Where the person stands as a member, said in a sentence: invited,
  // a member since a day with the shares they hold, suspended or gone;
  // summarising their Membership tab, which its footer opens. A panel of
  // the person's overview, where they hold a membership.
  let { data, id }: { data: Membership; id: string } = $props()

  const m = $derived(data.member)
  const shares = (n: number) => `${n} ${n === 1 ? 'share' : 'shares'}`
  const tones: Record<Status, Tone> = { active: 'positive', invited: 'accent', suspended: 'warning', exited: 'neutral' }
  const said = $derived.by(() => {
    if (!m) {
      return ''
    }
    if (m.status === 'invited') {
      return `Invited on ${date(m.invited)}, not yet a member.`
    }
    if (m.status === 'suspended') {
      return `A member since ${date(m.since)}, suspended on ${date(m.suspended)}, holding ${shares(m.shares)}.`
    }
    if (m.status === 'exited') {
      return `A member from ${date(m.since)} to ${date(m.exited)}.`
    }
    return `A member since ${date(m.since)}, holding ${shares(m.shares)}.`
  })
</script>

{#if m}
  <Panel title="Membership" icon={icons.Users} status={{ label: m.status, tone: tones[m.status] }}>
    <Prose text={said} />
    {#snippet actions()}
      <Button href="/people/{encodeURIComponent(id)}?tab=membership" lead={icons.ArrowRight}>Open membership</Button>
    {/snippet}
  </Panel>
{/if}
