<script module lang="ts">
  export const meta = {
    title: 'A signed, hash-chained log',
    alt: 'Time running down. The notary’s line appends one entry after another to a scope’s log: each entry names its action, carries the hash of the entry before it and is signed. The next entry, not yet written, is drawn dashed.',
    made: 'ai',
  } as const
</script>

<script lang="ts">
  import { Axis, Dot, Frame, Glyph, Line, Name, Particle } from './lang'

  // time runs down: each line starts below its name and ends at the foot
  const start = 70
  const end = 384
  const head = start - 46
  const notary = 74
  const x = 140
  const w = 250
  const h = 38
  // the entries, oldest first; the last is the next, unwritten
  const entries = [
    { n: 1, act: 'circle.found', hash: '9c1e04', prev: '000000' },
    { n: 2, act: 'motion.propose', hash: '3fa27b', prev: '9c1e04' },
    { n: 3, act: 'motion.consent', hash: 'b80d51', prev: '3fa27b' },
    { n: 4, act: 'mandate.grant', hash: '61e9c2', prev: 'b80d51' },
  ]
  const y = (i: number) => 76 + i * 62
</script>

<Frame width={440} height={418}>
  <Axis x={14} y1={start} y2={end} />

  <Line x={notary} y1={start} y2={end} />
  <Name x={notary} y={head} icon="stamp" name="Notary" kind="one per scope" />
  <Name x={x + w / 2} y={head} icon="scroll" name="Log" kind="append only" />

  {#each entries as e, i (e.n)}
    {@const at = y(i)}
    <Particle kind="record" x1={notary} y1={at + h / 2 - 8} x2={x} y2={at + h / 2} />
    <Dot x={notary} y={at + h / 2 - 8} />
    <rect class="box" x={x} y={at} width={w} height={h} rx="7" />
    <text class="code" x={x + 12} y={at + 16}>#{e.n}</text>
    <text class="code" x={x + 40} y={at + 16}>{e.act}</text>
    <text class="code quiet" x={x + 12} y={at + 30}>prev {e.prev}</text>
    <text class="code quiet" x={x + 112} y={at + 30}>hash {e.hash}</text>
    <Glyph name="seal-check" x={x + w} y={at + h / 2} />
    {#if i > 0}
      <!-- each entry carries the hash of the one before -->
      <Particle kind="chain" x1={x + 80} y1={at} x2={x + 140} y2={at - 62 + h} />
    {/if}
  {/each}

  <!-- the next entry, not yet written -->
  <rect class="box pending" x={x} y={y(4)} width={w} height={h} rx="7" />
  <text class="code quiet" x={x + 12} y={y(4) + 16}>#5</text>
  <text class="code quiet" x={x + 12} y={y(4) + 30}>prev 61e9c2</text>
  <Particle kind="chain" x1={x + 80} y1={y(4)} x2={x + 140} y2={y(4) - 62 + h} />
</Frame>
