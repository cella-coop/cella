<script module lang="ts">
  export const meta = {
    title: 'Members decide',
    alt: 'Worldlines with time running down. Ana, a member, puts a motion to the assembly. While the assembly deliberates, Ana, Ben and Cleo send their consent in turn. The motion passes: the assembly grants the Treasurer role a mandate narrower than its own and, in the same motion, Cleo takes the role. Cleo then pays as Treasurer under it.',
    made: 'ai',
  } as const
</script>

<script lang="ts">
  import { Auth, Axis, Dot, Frame, Glyph, Line, Name, Particle, Wait } from './lang'

  // time runs down: each line starts below its name and ends at the foot
  const start = 70
  const end = 384
  const head = start - 46
  const people = [
    { x: 74, name: 'Ana' },
    { x: 134, name: 'Ben' },
    { x: 194, name: 'Cleo' },
  ]
  const ga = 284
  const role = 386
  // every exchange falls at one slope, so time reads the same across
  // the diagram: the fall over a run
  const slope = 0.07
  const fall = (x1: number, x2: number) => Math.abs(x2 - x1) * slope
  // each member's consent, in their order, Ana's first
  const consents = [
    { x: 74, y: 120 },
    { x: 134, y: 146 },
    { x: 194, y: 172 },
  ]
  const motion = { y: 88, at: 88 + fall(74, ga) }
  const grant = { y: 238, at: 238 + fall(ga + 4, role) }
</script>

<Frame width={440} height={418}>
  <Axis x={14} y1={start} y2={start + 84} />

  <Auth x={ga} y1={start} y2={end} w={13} />
  <Auth x={role} y1={grant.at} y2={end} w={6} />

  {#each people as p (p.name)}
    <Line x={p.x} y1={start} y2={end} />
    <Name x={p.x} y={head} icon="user" name={p.name} kind="member" />
  {/each}
  <Line x={ga} y1={start} y2={end} kind="rails" />
  <Name x={ga} y={head} icon="users-three" name="Assembly" kind="circle" />
  <Line x={role} y1={start} y2={grant.at} vacant />
  <Line x={role} y1={grant.at} y2={end} />
  <Name x={role} y={head} icon="wallet" name="Treasurer" kind="role" />

  <!-- a motion put to the assembly, which deliberates -->
  <Particle kind="ask" x1={74} y1={motion.y} x2={ga} y2={motion.at} />
  <text class="say" x={106} y={107} text-anchor="middle">motion</text>
  <Wait x={ga} y1={motion.at} y2={192} />
  <Dot x={74} y={motion.y} />
  <Dot x={ga} y={motion.at} />

  <!-- each member consents, in turn -->
  {#each consents as c (c.x)}
    <Particle kind="answer" x1={c.x + 9} y1={c.y} x2={ga - 6} y2={c.y + fall(c.x + 9, ga - 6)} />
    <Glyph name="check" x={c.x} y={c.y} tone="ask" />
  {/each}
  <text class="say" x={238} y={196} text-anchor="middle">consent</text>

  <!-- the motion passes, and a narrower mandate goes to a role -->
  <Glyph name="gavel" x={ga} y={210} />
  <Particle kind="grant" x1={ga + 4} y1={grant.y} x2={role} y2={grant.at} />
  <text class="say" x={335} y={227} text-anchor="middle">mandate</text>
  <Dot x={ga} y={grant.y} />
  <Dot x={role} y={grant.at} />

  <!-- in the same motion, Cleo takes the role: a tick where her tenure
       starts, her name beside it -->
  <line class="tick" x1={role - 7} y1={grant.at} x2={role + 7} y2={grant.at} />
  <text class="say" x={role + 11} y={grant.at - 5}>Cleo</text>

  <!-- the treasurer, Cleo, pays under it -->
  <Glyph name="coins" x={role} y={310} />

</Frame>
