<!-- A vertex, where a particle leaves or meets a line; open where a line
     begins. Lines that cross without one do not interact. -->
<script lang="ts">
  let { x, y, open = false }: { x: number; y: number; open?: boolean } = $props()
</script>

<circle class="dot" class:open cx={x} cy={y} r={open ? 3.4 : 3} />
