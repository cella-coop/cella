<!-- A worldline from y1 down to y2: a circle's two rails, or one line for a
     role, a person or a scope's part; dashed while a role stands vacant. -->
<script lang="ts">
  import { rails } from './draw'

  let { x, y1, y2, kind = 'single', vacant = false }: { x: number; y1: number; y2: number; kind?: 'single' | 'rails'; vacant?: boolean } = $props()
</script>

{#if kind === 'rails'}
  <path class="line rails" class:vacant d={rails(x, y1, y2)} />
{:else}
  <line class="line" class:vacant x1={x} y1={y1} x2={x} y2={y2} />
{/if}
