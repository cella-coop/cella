<!-- A wait on a line at x, from y1 down to y2: the time a party takes to
     decide, shaded. -->
<script lang="ts">
  let { x, y1, y2 }: { x: number; y1: number; y2: number } = $props()
</script>

<rect class="wait" x={x - 6} y={Math.min(y1, y2)} width="12" height={Math.abs(y1 - y2)} rx="4" />
