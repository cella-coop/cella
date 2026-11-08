<script module lang="ts">
  export const meta = {
    title: 'A co-op joins the federation',
    alt: 'Worldlines with time running up. Two co-ops, each its own scope, exchange signed records. A third co-op, not yet in the federation, asks to join; the second deliberates and consents. From then on records flow to the newcomer too, each signed by the scope that sent it.',
    made: 'ai',
  } as const
</script>

<script lang="ts">
  import { Axis, Dot, Frame, Glyph, Line, Name, Particle, Wait } from './lang'

  const base = 344
  const top = 30
  const a = 100
  const b = 236
  const c = 382
  // where the newcomer joins
  const joins = 228
</script>

<Frame width={440} height={418}>
  <Axis x={14} y1={base} y2={top} />

  <Line x={a} y1={base} y2={top} kind="rails" />
  <Name x={a} y={base + 24} icon="users-three" name="Lanterne" kind="co-op" />
  <Line x={b} y1={base} y2={top} kind="rails" />
  <Name x={b} y={base + 24} icon="users-three" name="Fourneau" kind="co-op" />
  <Line x={c} y1={base} y2={joins} kind="rails" vacant />
  <Line x={c} y1={joins} y2={top} kind="rails" />
  <Name x={c} y={base + 24} icon="users-three" name="Yours" kind="co-op" />

  <!-- two scopes trade signed records -->
  <Particle kind="record" x1={a} y1={314} x2={b - 10} y2={303} />
  <Glyph name="seal-check" x={b} y={302} />
  <Dot x={a} y={314} />
  <text class="say" x={(a + b) / 2} y={298} text-anchor="middle">signed</text>
  <Particle kind="record" x1={b} y1={274} x2={a + 10} y2={263} />
  <Glyph name="seal-check" x={a} y={262} />
  <Dot x={b} y={274} />

  <!-- a newcomer asks to join, and is answered -->
  <Glyph name="handshake" x={c} y={joins} />
  <Particle kind="ask" x1={c} y1={206} x2={b} y2={195} />
  <text class="say" x={(b + c) / 2 + 8} y={190} text-anchor="middle">join?</text>
  <Dot x={c} y={206} />
  <Dot x={b} y={195} />
  <Wait x={b} y1={195} y2={146} />
  <Particle kind="answer" x1={b} y1={146} x2={c - 10} y2={135} />
  <Dot x={b} y={146} />
  <Glyph name="check" x={c} y={134} tone="ask" />

  <!-- from then on, records reach it too -->
  <Particle kind="record" x1={b} y1={104} x2={c - 10} y2={93} />
  <Dot x={b} y={104} />
  <Glyph name="seal-check" x={c} y={92} />
  <Particle kind="record" x1={a} y1={70} x2={c - 10} y2={55} />
  <Dot x={a} y={70} />
  <Glyph name="seal-check" x={c} y={54} />

</Frame>
