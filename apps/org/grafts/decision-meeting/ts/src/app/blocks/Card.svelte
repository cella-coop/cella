<script lang="ts">
  import { Badge, date } from '@cella/org-ui'
  import type { Summary } from '../../models/tabled.ts'

  // A decision inside a meeting's minutes, read on the meeting's page:
  // its title, circle, rule and where it stands, linking to its page.
  let { ref, data }: { ref: string; data: { decisions: Summary[] } } = $props()
  const d = $derived(data.decisions.find((x) => x.id === ref))
</script>

<div class="card">
  <div class="eyebrow">Decision · {ref}</div>
  {#if d}
    <a class="title" href="/decisions/{d.id}">{d.title}</a>
    <div class="meta">
      <Badge tone={d.closed ? 'neutral' : 'accent'}>{d.closed ? `closed ${date(d.closed)}` : `open until ${date(d.deadline)}`}</Badge>
      <span>{d.circle} · {d.rule}</span>
    </div>
  {:else}
    <div class="title">No such decision</div>
  {/if}
</div>
