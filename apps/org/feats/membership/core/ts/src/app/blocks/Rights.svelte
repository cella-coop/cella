<script lang="ts">
  import { date, Prose, Section } from '@cella/org-ui'
  import type { Membership } from '../../models/member.ts'

  // What membership is, in plain words: one member, one vote, whatever
  // one's shares or pay. What a member owns and the powers their seats
  // give are the slices' that keep them, read back beside it.
  let { data }: { data: Membership; id: string } = $props()

  const m = $derived(data.member)
  const first = $derived(m?.name.split(' ')[0] ?? '')
  const text = $derived(
    !m
      ? `Not a member. Membership is open to whoever works here: once invited and admitted by the assembly, a member owns a part of the coop with every other member and has one vote, the same as anyone's, whatever their shares or their pay.`
      : m.status === 'invited'
        ? `${first} is invited to join. Once the assembly admits them, ${first} owns a part of the coop with every other member and has one vote in the assembly, the same as anyone's, whatever their shares or their pay.`
        : m.status === 'active'
          ? `${first} has been a member since ${date(m.since)}. The coop is owned and run by its members, one member, one vote: ${first}'s vote in the assembly counts the same as anyone's, whatever their ${m.shares} shares or their pay.`
          : m.status === 'suspended'
            ? `${first}'s membership is suspended since ${date(m.suspended)}: until the assembly ends the suspension, ${first} votes nowhere and uses no power.`
            : `${first} left the coop on ${date(m.exited)}. Their capital is repaid as the statutes say; they no longer vote.`,
  )
</script>

<Section title="Membership">
  <Prose {text} />
</Section>
