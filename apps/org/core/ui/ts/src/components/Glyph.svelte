<script lang="ts">
  import type { Stage } from '../models/status.ts'

  // A status's category as a glyph, in its tone's colour: backlog a
  // dashed ring, unstarted a ring, started a ring filling as the state
  // runs on (`fill`), completed a disc with a check and cancelled one
  // with a cross, each cut out of it, so the glyph reads on any surface.
  let { stage, size = '1em' }: { stage: Stage; size?: string } = $props()

  const id = $props.id()
  const pie = $derived.by(() => {
    const a = 2 * Math.PI * stage.fill
    const x = 8 + 4 * Math.sin(a)
    const y = 8 - 4 * Math.cos(a)
    return `M8 8 L8 4 A4 4 0 ${stage.fill > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`
  })
</script>

<svg class="glyph" viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
  {#if stage.category === 'backlog'}
    <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.2 2" />
  {:else if stage.category === 'unstarted' || stage.category === 'started'}
    <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.6" />
    {#if stage.category === 'started'}<path d={pie} fill="currentColor" />{/if}
  {:else}
    <mask id="{id}-cut">
      <rect width="16" height="16" fill="white" />
      {#if stage.category === 'completed'}
        <path d="M4.8 8.2 7 10.3 11.2 5.9" fill="none" stroke="black" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
      {:else}
        <path d="M5.6 5.6 10.4 10.4 M10.4 5.6 5.6 10.4" stroke="black" stroke-width="1.7" stroke-linecap="round" />
      {/if}
    </mask>
    <circle cx="8" cy="8" r="7" fill="currentColor" mask="url(#{id}-cut)" />
  {/if}
</svg>

<style>
  .glyph {
    flex: none;
    display: inline-block;
    vertical-align: -0.125em;
  }
</style>
