<!-- What travels from one line to another: a grant's wave, a revoke's
     dashed wave, a request dashed, an answer solid, an objection window's
     zigzag, a cascade dotted, a signed record solid, a hash link fine. -->
<script lang="ts">
  import { straight, wave, zig } from './draw'

  type Kind = 'grant' | 'revoke' | 'ask' | 'answer' | 'object' | 'cascade' | 'record' | 'chain'
  let { kind, x1, y1, x2, y2 }: { kind: Kind; x1: number; y1: number; x2: number; y2: number } = $props()

  const d = $derived(
    kind === 'grant' || kind === 'revoke' ? wave(x1, y1, x2, y2) : kind === 'object' ? zig(x1, y1, x2, y2) : straight(x1, y1, x2, y2),
  )
</script>

<path class={kind} {d} />
