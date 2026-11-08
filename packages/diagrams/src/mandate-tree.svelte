<script module lang="ts">
  export const meta = {
    title: 'Authority attenuates',
    alt: 'Worldlines with time running up, each line as wide as the authority it holds. The general assembly grants the board a mandate narrower than its own; the board grants the Treasurer and the Buyer narrower ones still, and the Buyer acts. When the assembly revokes the board’s mandate, everything derived from it ends too, and the Buyer’s next act is refused.',
    made: 'ai',
  } as const
</script>

<script lang="ts">
  import { Auth, Axis, Dot, Frame, Glyph, Line, Name, Num, Particle } from './lang'

  const base = 344
  const top = 30
  const ga = 84
  const board = 184
  const buyer = 284
  const treasurer = 378
</script>

<Frame width={440} height={418}>
  <Axis x={14} y1={base} y2={top} />

  <!-- each line as wide as what it holds, until a revoke ends it -->
  <Auth x={ga} y1={base} y2={top} w={15} />
  <Auth x={board} y1={300} y2={114} w={10} />
  <Auth x={treasurer} y1={246} y2={86} w={6} />
  <Auth x={buyer} y1={196} y2={94} w={3.5} />

  <Line x={ga} y1={base} y2={top} kind="rails" />
  <Name x={ga} y={base + 24} icon="users-three" name="GA" kind="circle" />
  <Line x={board} y1={base} y2={top} kind="rails" />
  <Name x={board} y={base + 24} icon="users-three" name="Board" kind="circle" />
  <Line x={buyer} y1={base} y2={196} vacant />
  <Line x={buyer} y1={196} y2={top} />
  <Name x={buyer} y={base + 24} icon="identification-badge" name="Buyer" kind="role" />
  <Line x={treasurer} y1={base} y2={246} vacant />
  <Line x={treasurer} y1={246} y2={top} />
  <Name x={treasurer} y={base + 24} icon="identification-badge" name="Treasurer" kind="role" />

  <!-- grants, each narrower than its sender -->
  <Particle kind="grant" x1={ga + 4} y1={312} x2={board} y2={300} />
  <Dot x={ga} y={312} />
  <Dot x={board} y={300} />
  <Particle kind="grant" x1={board + 4} y1={260} x2={treasurer} y2={246} />
  <Dot x={board} y={260} />
  <Dot x={treasurer} y={246} />
  <text class="code" x={334} y={236} text-anchor="middle">≤ €5k</text>
  <Particle kind="grant" x1={board + 4} y1={208} x2={buyer} y2={196} />
  <Dot x={board} y={208} />
  <Dot x={buyer} y={196} />
  <text class="code" x={240} y={186} text-anchor="middle">≤ €1k</text>

  <Glyph name="stamp" x={buyer} y={156} />

  <!-- a revoke, and its cascade down what derives from it -->
  <Particle kind="revoke" x1={ga + 4} y1={126} x2={board - 10} y2={114} />
  <Dot x={ga} y={126} />
  <Glyph name="link-break" x={board} y={114} tone="no" />
  <Particle kind="cascade" x1={board + 10} y1={110} x2={buyer - 10} y2={96} />
  <Glyph name="link-break" x={buyer} y={94} tone="no" />
  <Particle kind="cascade" x1={board + 9} y1={118} x2={treasurer - 10} y2={88} />
  <Glyph name="link-break" x={treasurer} y={86} tone="no" />

  <Glyph name="prohibit" x={buyer} y={50} tone="no" refused />

  <Num n={1} x={42} y={306} />
  <Num n={2} x={42} y={230} />
  <Num n={3} x={42} y={156} />
  <Num n={4} x={42} y={112} />
  <Num n={5} x={42} y={50} />
</Frame>
