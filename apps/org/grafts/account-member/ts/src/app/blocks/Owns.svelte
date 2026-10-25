<script lang="ts">
  import { money, Prose, Section } from '@cella/org-ui'
  import type { Rights } from '../../models/capital.ts'

  // What a member owns, in plain words, read back from their capital and
  // the statutes' capital clauses in force: their shares, and how capital
  // is repaid to one who leaves.
  let { data }: { data: Rights | null; id: string } = $props()

  const first = $derived(data?.name.split(' ')[0] ?? '')
  const s = $derived(data?.statutes)
  const text = $derived(
    !data || !s
      ? ''
      : [
          data.shares > 0
            ? `${first} holds ${data.shares} shares of ${money(data.value)}, ${money(data.subscribed)} of the co-op's capital${data.account ? `, in account ${data.account}` : ''}.`
            : `${first} holds no shares yet. An associate subscribes at least ${s.minimum} shares of ${money(s.share)}, and may pay them in up to ${s.instalments} monthly instalments from their pay.`,
          `An associate who leaves is repaid their capital at the share's value, the first repayment ${s.delay} months after they leave, in ${s.repayments} yearly repayments.`,
          `These are the statutes' capital terms ${s.terms}, which only the assembly changes.`,
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
