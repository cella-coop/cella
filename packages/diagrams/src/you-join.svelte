<script module lang="ts">
  export const meta = {
    title: 'You join',
    alt: 'Worldlines with time running up. Cella, a coop, and Matan, its one member. You stand beside them, not yet a member, and apply: a motion that You join is put to Cella. While Cella deliberates, Matan consents; the motion passes and You are admitted, a member from then on. Cella then grants the Cofounder role a mandate narrower than its own, and You take the role. The cofounder’s first act under it: coffee.',
    made: 'ai',
  } as const
</script>

<script lang="ts">
  import { Auth, Axis, Dot, Frame, Glyph, Line, Name, Particle, Wait } from './lang'

  const base = 344
  const top = 30
  const matan = 74
  const cella = 184
  const you = 284
  const role = 386
  // every exchange climbs at one slope, so time reads the same across
  // the diagram: the rise over a run
  const slope = 0.07
  const rise = (x1: number, x2: number) => Math.abs(x2 - x1) * slope
  const motion = { y: 318, at: 318 - rise(you, cella) }
  const consent = { y: 280, at: 280 - rise(matan + 9, cella - 6) }
  // where You are admitted, a member from there on
  const admit = { y: 200, at: 200 - rise(cella, you - 10) }
  const grant = { y: 150, at: 150 - rise(cella + 4, role) }
</script>

<Frame width={440} height={418}>
  <Axis x={14} y1={base} y2={top} />

  <Auth x={cella} y1={base} y2={top} w={13} />
  <Auth x={role} y1={grant.at} y2={top} w={6} />

  <Line x={matan} y1={base} y2={top} />
  <Name x={matan} y={base + 24} icon="user" name="Matan" kind="member" />
  <Line x={cella} y1={base} y2={top} kind="rails" />
  <Name x={cella} y={base + 24} icon="users-three" name="Cella" kind="coop" />
  <Line x={you} y1={base} y2={admit.at} vacant />
  <Line x={you} y1={admit.at} y2={top} />
  <Name x={you} y={base + 24} icon="user" name="You" kind="member" />
  <Line x={role} y1={base} y2={grant.at} vacant />
  <Line x={role} y1={grant.at} y2={top} />
  <Name x={role} y={base + 24} icon="identification-badge" name="Cofounder" kind="role" />

  <!-- You apply: a motion put to Cella, which deliberates -->
  <Particle kind="ask" x1={you} y1={motion.y} x2={cella} y2={motion.at} />
  <text class="say" x={(you + cella) / 2} y={motion.at - 6} text-anchor="middle">You join</text>
  <Wait x={cella} y1={motion.at} y2={234} />
  <Dot x={you} y={motion.y} />
  <Dot x={cella} y={motion.at} />

  <!-- its one member consents -->
  <Particle kind="answer" x1={matan + 9} y1={consent.y} x2={cella - 6} y2={consent.at} />
  <Glyph name="check" x={matan} y={consent.y} tone="ask" />
  <text class="say" x={(matan + cella) / 2 + 4} y={consent.at - 9} text-anchor="middle">consent</text>

  <!-- the motion passes, and You are admitted -->
  <Glyph name="gavel" x={cella} y={218} />
  <Particle kind="answer" x1={cella} y1={admit.y} x2={you - 10} y2={admit.at} />
  <text class="say" x={(cella + you) / 2 - 4} y={admit.at - 10} text-anchor="middle">welcome</text>
  <Dot x={cella} y={admit.y} />
  <Glyph name="handshake" x={you} y={admit.at} tone="ask" />

  <!-- a narrower mandate goes to the role, and You take it: a tick where
       the tenure starts, the name beside it -->
  <Particle kind="grant" x1={cella + 4} y1={grant.y} x2={role} y2={grant.at} />
  <text class="say" x={337} y={grant.at - 12} text-anchor="middle">mandate</text>
  <Dot x={cella} y={grant.y} />
  <Dot x={role} y={grant.at} />
  <line class="tick" x1={role - 7} y1={grant.at} x2={role + 7} y2={grant.at} />
  <text class="say" x={role + 11} y={grant.at + 14}>You</text>

  <!-- the cofounder's first act under it -->
  <Glyph name="coffee" x={role} y={78} />

</Frame>
