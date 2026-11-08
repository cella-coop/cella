<script module lang="ts">
  export const meta = {
    title: 'Members decide',
    alt: 'Worldlines with time running up. Ana, a member, puts a motion to the assembly. While the assembly deliberates, Ana, Ben and Cleo send their consent in turn. The motion passes, the assembly grants the Treasurer role a mandate narrower than its own, and the Treasurer then pays under it.',
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
  // every exchange climbs at one slope, so time reads the same across
  // the diagram: the rise over a run
  const slope = 0.07
  const rise = (x1: number, x2: number) => Math.abs(x2 - x1) * slope
  // each member's consent, in their order, Ana's first
  const consents = [
    { x: 74, y: 294 },
    { x: 134, y: 268 },
    { x: 194, y: 242 },
  ]
  const motion = { y: 326, at: 326 - rise(74, ga) }
  const grant = { y: 176, at: 176 - rise(ga + 4, role) }
</script>

<Frame width={440} height={418}>
  <Axis x={14} y1={base} y2={base - 84} />

  <Auth x={ga} y1={base} y2={top} w={13} />
  <Auth x={role} y1={grant.at} y2={top} w={6} />

  {#each people as p (p.name)}
    <Line x={p.x} y1={base} y2={top} />
    <Name x={p.x} y={base + 24} icon="user" name={p.name} kind="member" />
  {/each}
  <Line x={ga} y1={base} y2={top} kind="rails" />
  <Name x={ga} y={base + 24} icon="users-three" name="Assembly" kind="circle" />
  <Line x={role} y1={base} y2={grant.at} vacant />
  <Line x={role} y1={grant.at} y2={top} />
  <Name x={role} y={base + 24} icon="wallet" name="Treasurer" kind="role" />

  <!-- a motion put to the assembly, which deliberates -->
  <Particle kind="ask" x1={74} y1={motion.y} x2={ga} y2={motion.at} />
  <text class="say" x={106} y={315} text-anchor="middle">motion</text>
  <Wait x={ga} y1={motion.at} y2={222} />
  <Dot x={74} y={motion.y} />
  <Dot x={ga} y={motion.at} />

  <!-- each member consents, in turn -->
  {#each consents as c (c.x)}
    <Particle kind="answer" x1={c.x + 9} y1={c.y} x2={ga - 6} y2={c.y - rise(c.x + 9, ga - 6)} />
    <Glyph name="check" x={c.x} y={c.y} tone="ask" />
  {/each}
  <text class="say" x={238} y={226} text-anchor="middle">consent</text>

  <!-- the motion passes, and a narrower mandate goes to a role -->
  <Glyph name="gavel" x={ga} y={204} />
  <Particle kind="grant" x1={ga + 4} y1={grant.y} x2={role} y2={grant.at} />
  <text class="say" x={335} y={158} text-anchor="middle">mandate</text>
  <Dot x={ga} y={grant.y} />
  <Dot x={role} y={grant.at} />

  <!-- the treasurer pays under it -->
  <Glyph name="coins" x={role} y={104} />

</Frame>
