<script module lang="ts">
  export const meta = {
    title: 'One scope, one notary',
    alt: 'Worldlines with time running down. A member sends an action to the scope’s notary, which judges it and writes the state and the signed log together in one transaction, then answers that it is done. A second action fails a guard: the notary refuses it and writes nothing.',
    made: 'ai',
  } as const
</script>

<script lang="ts">
  import { Axis, Dot, Frame, Glyph, Line, Name, Particle, Wait } from './lang'

  // time runs down: each line starts below its name and ends at the foot
  const start = 70
  const end = 384
  const head = start - 46
  const member = 74
  const notary = 196
  const state = 300
  const log = 386
</script>

<Frame width={440} height={418}>
  <Axis x={14} y1={start} y2={end} />

  <Line x={member} y1={start} y2={end} />
  <Name x={member} y={head} icon="user" name="Ana" kind="member" />
  <Line x={notary} y1={start} y2={end} kind="rails" />
  <Name x={notary} y={head} icon="stamp" name="Notary" kind="scope" />
  <Line x={state} y1={start} y2={end} />
  <Name x={state} y={head} icon="database" name="State" kind="tables" />
  <Line x={log} y1={start} y2={end} />
  <Name x={log} y={head} icon="scroll" name="Log" kind="signed" />

  <!-- an action, judged, written whole, answered -->
  <Particle kind="ask" x1={member} y1={102} x2={notary} y2={114} />
  <text class="say" x={130} y={126} text-anchor="middle">action</text>
  <Dot x={member} y={102} />
  <Dot x={notary} y={114} />
  <Wait x={notary} y1={114} y2={156} />
  <rect class="span" x={notary - 12} y={158} width={log - notary + 24} height={30} rx="8" />
  <text class="kind" x={(notary + log) / 2 + 10} y={200} text-anchor="middle">one transaction</text>
  <Particle kind="record" x1={notary} y1={168} x2={state} y2={176} />
  <Particle kind="record" x1={notary} y1={168} x2={log - 10} y2={176} />
  <Dot x={notary} y={168} />
  <Dot x={state} y={176} />
  <Glyph name="seal-check" x={log} y={176} />
  <Particle kind="answer" x1={notary} y1={218} x2={member + 10} y2={230} />
  <Dot x={notary} y={218} />
  <Glyph name="check" x={member} y={231} tone="ask" />

  <!-- a second fails a guard: refused, nothing written -->
  <Particle kind="ask" x1={member} y1={274} x2={notary} y2={286} />
  <Dot x={member} y={274} />
  <Dot x={notary} y={286} />
  <Wait x={notary} y1={286} y2={318} />
  <Particle kind="answer" x1={notary} y1={318} x2={member + 10} y2={330} />
  <Dot x={notary} y={318} />
  <Glyph name="x" x={member} y={331} tone="no" />

</Frame>
