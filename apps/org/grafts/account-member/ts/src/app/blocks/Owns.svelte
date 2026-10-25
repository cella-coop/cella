<script lang="ts">
  import { money, Prose, Section } from '@cella/org-ui'
  import type { Rights } from '../../models/capital.ts'

  // What a member owns, in plain words, read back from their capital and
  // the statutes' terms in force: their shares, how the work share
  // divides and what of it buys shares, and how capital is repaid to one
  // who leaves.
  let { data }: { data: Rights | null; id: string } = $props()

  const first = $derived(data?.name.split(' ')[0] ?? '')
  const s = $derived(data?.statutes)
  const bases = $derived(
    !s
      ? ''
      : [
          s.salary ? `${s.salary} % by pay` : '',
          s.hours ? `${s.hours} % by time worked` : '',
          s.equal ? `${s.equal} % in equal parts` : '',
        ]
          .filter(Boolean)
          .join(', '),
  )
  const text = $derived(
    !data || !s
      ? ''
      : [
          data.shares > 0
            ? `${first} holds ${data.shares} shares of ${money(data.value)}, ${money(data.subscribed)} of the co-op's capital${data.account ? `, in account ${data.account}` : ''}.`
            : s.share
              ? `${first} holds no shares yet. An associate subscribes at least ${s.minimum} shares of ${money(s.share)}, and may pay them in up to ${s.instalments} monthly instalments from their pay.`
              : '',
          `Each year the assembly shares out the surplus as the law and the statutes say: the work share goes to the workers, ${bases}${s.capital ? `, and ${s.capital} % of each associate's part buys them shares, blocked five years, the rest paid` : ', paid'}.`,
          s.share && s.repayments
            ? `An associate who leaves is repaid their capital at the share's value, the first repayment ${s.delay} months after they leave, in ${s.repayments} yearly repayments.`
            : '',
          `These are the statutes' terms ${s.terms}, which only the assembly changes.`,
        ]
          .filter(Boolean)
          .join('\n\n'),
  )
</script>

{#if text}
  <Section title="What {first} owns">
    <Prose {text} />
  </Section>
{/if}
