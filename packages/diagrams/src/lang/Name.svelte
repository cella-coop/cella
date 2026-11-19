<!-- A line's name at its head, where it starts: its kind's glyph, bare,
     then its name in the display face and its kind in small mono capitals. -->
<script lang="ts">
  import { GLYPHS, type GlyphName } from './glyphs'

  let { x, y, icon, name, kind }: { x: number; y: number; icon?: GlyphName; name: string; kind?: string } = $props()
</script>

{#if icon}
  <path class="icon" d={GLYPHS[icon]} transform="translate({x - 7.5} {y - 7.5}) scale({15 / 256})" />
{/if}
<text class="name" x={x} y={y + (icon ? 22 : 4)} text-anchor="middle">{name}</text>
{#if kind}
  <text class="kind" x={x} y={y + (icon ? 34 : 16)} text-anchor="middle">{kind}</text>
{/if}
