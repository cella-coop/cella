<script lang="ts">
  import { Badge, date } from '@cella/org-ui'
  import type { Summary } from '../../models/motion.ts'

  // A motion drawn as a card where another slice shows it, inside a
  // document or a meeting's minutes: its title, author, method and where it
  // stands, linking to its page. The slice hands the motions it read.
  let { ref, data }: { ref: string; data: { motions: Summary[] } } = $props()
  const d = $derived(data.motions.find((x) => x.id === ref))
</script>

<div class="card">
  <div class="kind">Motion · {ref}</div>
  {#if d}
    <a class="title" href="/motions/{d.id}">{d.title}</a>
    <div class="meta">
      <Badge tone={d.closed ? 'neutral' : 'accent'}>{d.closed ? `closed ${date(d.closed)}` : `open until ${date(d.deadline)}`}</Badge>
      <span>{d.circleName} · put by {d.authorName} · {d.method}</span>
    </div>
  {:else}
    <div class="title">No such motion</div>
  {/if}
</div>
