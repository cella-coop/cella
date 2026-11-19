<!-- Authority held along a worldline from y1 down to y2, its width the
     scope of what it holds: a grant is never wider than its sender's. -->
<script lang="ts">
  let { x, y1, y2, w }: { x: number; y1: number; y2: number; w: number } = $props()
</script>

<line class="auth" x1={x} y1={y1} x2={x} y2={y2} stroke-width={w} />
