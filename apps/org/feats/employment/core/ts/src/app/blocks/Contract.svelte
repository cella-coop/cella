<script lang="ts">
  import { Button, date, icons, Panel, Prose } from '@cella/org-ui'
  import { terms, type Employment } from '../../models/worker.ts'

  // The person's contract, said in a sentence: their job, its terms, its
  // hours and since when, or when it ended; summarising their Work tab,
  // which its footer opens. A panel of the person's overview, where they
  // were ever employed.
  let { data, id }: { data: Employment; id: string } = $props()

  const w = $derived(data.worker)
  // The job as the sentence's first word.
  const job = $derived(w ? `${w.job.charAt(0).toUpperCase()}${w.job.slice(1)}` : '')
</script>

{#if w}
  <Panel title="Work" icon={icons.Briefcase} status={w.employed ? { label: 'employed', tone: 'positive' } : { label: 'ended', tone: 'neutral' }}>
    <Prose
      text={`${job}, ${terms[w.contract].toLowerCase()}, ${w.hours} hours a week, ${w.employed ? `since ${date(w.start)}${w.until ? ` until ${date(w.until)}` : ''}` : `from ${date(w.start)} to ${date(w.until)}`}.`}
    />
    {#snippet actions()}
      <Button href="/people/{encodeURIComponent(id)}?tab=work" lead={icons.ArrowRight}>Open work</Button>
    {/snippet}
  </Panel>
{/if}
