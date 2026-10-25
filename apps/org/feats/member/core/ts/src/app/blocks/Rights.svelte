<script lang="ts">
  import { date, Prose, Section } from '@cella/org-ui'
  import type { Member } from '../../models/member.ts'

  // What membership is, in plain words: one member, one vote, whatever
  // one's shares or pay. What a member owns and the powers their seats
  // give are the slices' that keep them, read back beside it.
  let { data }: { data: Member; id: string } = $props()

  const first = $derived(data.name.split(' ')[0])
  const text = $derived(
    data.status === 'invited'
      ? `${first} is invited to join. Once the assembly admits them, ${first} owns a part of the co-op with every other member and has one vote in the assembly, the same as anyone's, whatever their shares or their pay.`
      : data.status === 'active'
        ? `${first} has been a member since ${date(data.since)}. The co-op is owned and run by its members, one member, one vote: ${first}'s vote in the assembly counts the same as anyone's, whatever their ${data.shares} shares or their pay.`
        : data.status === 'suspended'
          ? `${first}'s membership is suspended since ${date(data.suspended)}: until the assembly ends the suspension, ${first} votes nowhere and uses no power.`
          : `${first} left the co-op on ${date(data.exited)}. Their capital is repaid as the statutes say; they no longer vote.`,
  )
</script>

<Section title="Membership">
  <Prose {text} />
</Section>
