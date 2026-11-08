<!-- A step's number, in a hairline ring. -->
<script lang="ts">
  let { n, x, y }: { n: number; x: number; y: number } = $props()
</script>

<g class="num">
  <circle cx={x} cy={y} r="7.5" />
  <text x={x} y={y + 3.3} text-anchor="middle">{n}</text>
</g>
