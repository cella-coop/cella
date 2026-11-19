<script module lang="ts">
  export const meta = {
    title: 'A coop joins the federation',
    alt: 'Worldlines with time running down. Two coops, each its own scope, exchange signed records. A third coop, not yet in the federation, asks to join; the second deliberates and consents. From then on records flow to the newcomer too, each signed by the scope that sent it.',
    made: 'ai',
  } as const
</script>

<script lang="ts">
  import { Axis, Dot, Frame, Glyph, Line, Name, Particle, Wait } from './lang'

  // time runs down: each line starts below its name and ends at the foot
  const start = 70
  const end = 384
  const head = start - 46
  const a = 100
  const b = 236
  const c = 382
  // where the newcomer joins
  const joins = 186
</script>

<Frame width={440} height={418}>
  <Axis x={14} y1={start} y2={end} />

  <Line x={a} y1={start} y2={end} kind="rails" />
  <Name x={a} y={head} icon="users-three" name="Lanterne" kind="coop" />
  <Line x={b} y1={start} y2={end} kind="rails" />
  <Name x={b} y={head} icon="users-three" name="Fourneau" kind="coop" />
  <Line x={c} y1={start} y2={joins} kind="rails" vacant />
  <Line x={c} y1={joins} y2={end} kind="rails" />
  <Name x={c} y={head} icon="users-three" name="Yours" kind="coop" />

  <!-- two scopes trade signed records -->
  <Particle kind="record" x1={a} y1={100} x2={b - 10} y2={111} />
  <Glyph name="seal-check" x={b} y={112} />
  <Dot x={a} y={100} />
  <text class="say" x={(a + b) / 2} y={124} text-anchor="middle">signed</text>
  <Particle kind="record" x1={b} y1={140} x2={a + 10} y2={151} />
  <Glyph name="seal-check" x={a} y={152} />
  <Dot x={b} y={140} />

  <!-- a newcomer asks to join, and is answered -->
  <Glyph name="handshake" x={c} y={joins} />
  <Particle kind="ask" x1={c} y1={208} x2={b} y2={219} />
  <text class="say" x={(b + c) / 2 + 8} y={232} text-anchor="middle">join?</text>
  <Dot x={c} y={208} />
  <Dot x={b} y={219} />
  <Wait x={b} y1={219} y2={268} />
  <Particle kind="answer" x1={b} y1={268} x2={c - 10} y2={279} />
  <Dot x={b} y={268} />
  <Glyph name="check" x={c} y={280} tone="ask" />

  <!-- from then on, records reach it too -->
  <Particle kind="record" x1={b} y1={310} x2={c - 10} y2={321} />
  <Dot x={b} y={310} />
  <Glyph name="seal-check" x={c} y={322} />
  <Particle kind="record" x1={a} y1={344} x2={c - 10} y2={359} />
  <Dot x={a} y={344} />
  <Glyph name="seal-check" x={c} y={360} />

</Frame>
