<!-- The time axis: a hairline from y1 down to y2 with an open chevron at
     its head and its word under it, so nothing else needs an arrow. -->
<script lang="ts">
  let { x, y1, y2, label = 'time' }: { x: number; y1: number; y2: number; label?: string } = $props()
</script>

<path class="axis" d="M{x} {y1}V{y2}M{x - 3.5} {y2 - 5}L{x} {y2}L{x + 3.5} {y2 - 5}" />
<text class="kind" x={x} y={y2 + 14} text-anchor="middle">{label}</text>
