<!-- What happens at a vertex: a Phosphor glyph in a ring, its tone the
     particle's it answers; a refused act's ring is dashed. -->
<script lang="ts">
  import { GLYPHS, type GlyphName } from './glyphs'

  let {
    name,
    x,
    y,
    tone,
    refused = false,
    r = 10,
  }: { name: GlyphName; x: number; y: number; tone?: 'grant' | 'no' | 'ask'; refused?: boolean; r?: number } = $props()

  const s = $derived(r * 1.25)
</script>

<g class="glyph {tone ? `tone-${tone}` : ''}" class:refused>
  <circle cx={x} cy={y} {r} />
  <path class="icon" d={GLYPHS[name]} transform="translate({x - s / 2} {y - s / 2}) scale({s / 256})" />
</g>
