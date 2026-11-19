<script lang="ts">
  import { Value, date } from '@cella/org-ui'
  import { status } from '@cella/org-meeting/models'
  import type { Summary } from '../../models/minutes.ts'

  // A meeting drawn inside a document, as its minutes open with it: its
  // title, circle, day and time and where it stands, linking to its page.
  let { ref, data }: { ref: string; data: { meetings: Summary[] } } = $props()
  const m = $derived(data.meetings.find((x) => x.id === ref))
</script>

<div class="card">
  <div class="kind">Meeting · {ref}</div>
  {#if m}
    <a class="title" href="/meetings/{m.id}">{m.title}</a>
    <div class="meta">
      <Value value={m.status} kind="status" states={status} />
      <span>{m.circle} · {date(m.at)}, {m.at.slice(11, 16)}</span>
    </div>
  {:else}
    <div class="title">No such meeting</div>
  {/if}
</div>
