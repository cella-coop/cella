<script module lang="ts">
  export const meta = {
    title: 'Members decide',
    alt: 'Worldlines with time running up. Ana, a member, puts a motion to the assembly. While the assembly deliberates, Ana, Ben and Cleo each send their consent. The assembly adopts the motion and grants the Treasurer role a mandate narrower than its own, and the Treasurer then acts under it.',
    made: 'ai',
  } as const
</script>

<script lang="ts">
  import { Auth, Axis, Dot, Frame, Glyph, Line, Name, Particle, Wait } from './lang'

  const base = 344
  const top = 30
  const people = [
    { x: 74, name: 'Ana' },
    { x: 134, name: 'Ben' },
    { x: 194, name: 'Cleo' },
  ]
  const ga = 284
  const role = 386
  // each member's consent, from the last asked to the first
  const consents = [
    { x: 194, y: 290 },
    { x: 134, y: 270 },
    { x: 74, y: 250 },
  ]
</script>

<Frame width={440} height={418}>
  <Axis x={14} y1={base} y2={top} />

  <Auth x={ga} y1={base} y2={top} w={13} />
  <Auth x={role} y1={162} y2={top} w={6} />

  {#each people as p (p.name)}
    <Line x={p.x} y1={base} y2={top} />
    <Name x={p.x} y={base + 24} icon="user" name={p.name} kind="member" />
  {/each}
  <Line x={ga} y1={base} y2={top} kind="rails" />
  <Name x={ga} y={base + 24} icon="users-three" name="Assembly" kind="circle" />
  <Line x={role} y1={base} y2={162} vacant />
  <Line x={role} y1={162} y2={top} />
  <Name x={role} y={base + 24} icon="identification-badge" name="Treasurer" kind="role" />

  <!-- a motion put to the assembly, which deliberates -->
  <Particle kind="ask" x1={74} y1={318} x2={ga} y2={306} />
  <text class="say" x={106} y={308} text-anchor="middle">motion</text>
  <Wait x={ga} y1={306} y2={232} />
  <Dot x={74} y={318} />
  <Dot x={ga} y={306} />

  <!-- each member consents -->
  {#each consents as c (c.x)}
    <Particle kind="answer" x1={c.x + 9} y1={c.y} x2={ga - 6} y2={c.y - 8} />
    <Glyph name="check" x={c.x} y={c.y} tone="ask" />
  {/each}
  <text class="say" x={238} y={234} text-anchor="middle">consent</text>

  <!-- adopted, and a narrower mandate granted to a role -->
  <Glyph name="stamp" x={ga} y={214} />
  <Particle kind="grant" x1={ga + 4} y1={176} x2={role} y2={162} />
  <text class="say" x={335} y={152} text-anchor="middle">mandate</text>
  <Dot x={ga} y={176} />
  <Dot x={role} y={162} />

  <!-- the role acts under it -->
  <Glyph name="stamp" x={role} y={104} />

</Frame>
