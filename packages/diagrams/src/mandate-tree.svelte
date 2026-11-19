<script module lang="ts">
  export const meta = {
    title: 'Authority attenuates',
    alt: 'Worldlines with time running down, each line as wide as the authority it holds. The general assembly grants the board a mandate narrower than its own; the board grants the Treasurer and the Buyer narrower ones still, and the Buyer acts. When the assembly revokes the board’s mandate, everything derived from it ends too, and the Buyer’s next act is refused.',
    made: 'ai',
  } as const
</script>

<script lang="ts">
  import { Auth, Axis, Dot, Frame, Glyph, Line, Name, Particle } from './lang'

  // time runs down: each line starts below its name and ends at the foot
  const start = 70
  const end = 384
  const head = start - 46
  const ga = 84
  const board = 184
  const buyer = 284
  const treasurer = 378
</script>

<Frame width={440} height={418}>
  <Axis x={14} y1={start} y2={end} />

  <!-- each line as wide as what it holds, until a revoke ends it -->
  <Auth x={ga} y1={start} y2={end} w={15} />
  <Auth x={board} y1={114} y2={300} w={10} />
  <Auth x={treasurer} y1={168} y2={328} w={6} />
  <Auth x={buyer} y1={218} y2={320} w={3.5} />

  <Line x={ga} y1={start} y2={end} kind="rails" />
  <Name x={ga} y={head} icon="users-three" name="GA" kind="circle" />
  <Line x={board} y1={start} y2={end} kind="rails" />
  <Name x={board} y={head} icon="users-three" name="Board" kind="circle" />
  <Line x={buyer} y1={start} y2={218} vacant />
  <Line x={buyer} y1={218} y2={end} />
  <Name x={buyer} y={head} icon="identification-badge" name="Buyer" kind="role" />
  <Line x={treasurer} y1={start} y2={168} vacant />
  <Line x={treasurer} y1={168} y2={end} />
  <Name x={treasurer} y={head} icon="identification-badge" name="Treasurer" kind="role" />

  <!-- grants, each narrower than its sender -->
  <Particle kind="grant" x1={ga + 4} y1={102} x2={board} y2={114} />
  <Dot x={ga} y={102} />
  <Dot x={board} y={114} />
  <Particle kind="grant" x1={board + 4} y1={154} x2={treasurer} y2={168} />
  <Dot x={board} y={154} />
  <Dot x={treasurer} y={168} />
  <text class="code" x={334} y={152} text-anchor="middle">≤ €5k</text>
  <Particle kind="grant" x1={board + 4} y1={206} x2={buyer} y2={218} />
  <Dot x={board} y={206} />
  <Dot x={buyer} y={218} />
  <text class="code" x={240} y={198} text-anchor="middle">≤ €1k</text>

  <Glyph name="stamp" x={buyer} y={258} />

  <!-- a revoke, and its cascade down what derives from it -->
  <Particle kind="revoke" x1={ga + 4} y1={288} x2={board - 10} y2={300} />
  <Dot x={ga} y={288} />
  <Glyph name="link-break" x={board} y={300} tone="no" />
  <Particle kind="cascade" x1={board + 10} y1={304} x2={buyer - 10} y2={318} />
  <Glyph name="link-break" x={buyer} y={320} tone="no" />
  <Particle kind="cascade" x1={board + 9} y1={296} x2={treasurer - 10} y2={326} />
  <Glyph name="link-break" x={treasurer} y={328} tone="no" />

  <Glyph name="prohibit" x={buyer} y={364} tone="no" refused />

</Frame>
