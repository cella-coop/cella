<script module lang="ts">
  export const meta = {
    title: 'One scope, one notary',
    alt: 'Worldlines with time running up. A member sends an action to the scope’s notary, which judges it and writes the state and the signed log together in one transaction, then answers that it is done. A second action fails a guard: the notary refuses it and writes nothing.',
    made: 'ai',
  } as const
</script>

<script lang="ts">
  import { Axis, Dot, Frame, Glyph, Line, Name, Num, Particle, Wait } from './lang'

  const base = 344
  const top = 30
  const member = 74
  const notary = 196
  const state = 300
  const log = 386
</script>

<Frame width={440} height={418}>
  <Axis x={14} y1={base} y2={top} />

  <Line x={member} y1={base} y2={top} />
  <Name x={member} y={base + 24} icon="user" name="Ana" kind="member" />
  <Line x={notary} y1={base} y2={top} kind="rails" />
  <Name x={notary} y={base + 24} icon="stamp" name="Notary" kind="scope" />
  <Line x={state} y1={base} y2={top} />
  <Name x={state} y={base + 24} icon="database" name="State" kind="tables" />
  <Line x={log} y1={base} y2={top} />
  <Name x={log} y={base + 24} icon="scroll" name="Log" kind="signed" />

  <!-- an action, judged, written whole, answered -->
  <Particle kind="ask" x1={member} y1={312} x2={notary} y2={300} />
  <text class="say" x={130} y={296} text-anchor="middle">action</text>
  <Dot x={member} y={312} />
  <Dot x={notary} y={300} />
  <Wait x={notary} y1={300} y2={258} />
  <rect class="span" x={notary - 12} y={226} width={log - notary + 24} height={30} rx="8" />
  <text class="kind" x={(notary + log) / 2 + 10} y={220} text-anchor="middle">one transaction</text>
  <Particle kind="record" x1={notary} y1={246} x2={state} y2={238} />
  <Particle kind="record" x1={notary} y1={246} x2={log - 10} y2={238} />
  <Dot x={notary} y={246} />
  <Dot x={state} y={238} />
  <Glyph name="seal-check" x={log} y={238} />
  <Particle kind="answer" x1={notary} y1={196} x2={member + 10} y2={184} />
  <Dot x={notary} y={196} />
  <Glyph name="check" x={member} y={183} tone="ask" />

  <!-- a second fails a guard: refused, nothing written -->
  <Particle kind="ask" x1={member} y1={140} x2={notary} y2={128} />
  <Dot x={member} y={140} />
  <Dot x={notary} y={128} />
  <Wait x={notary} y1={128} y2={96} />
  <Particle kind="answer" x1={notary} y1={96} x2={member + 10} y2={84} />
  <Dot x={notary} y={96} />
  <Glyph name="x" x={member} y={83} tone="no" />

  <Num n={1} x={42} y={312} />
  <Num n={2} x={42} y={246} />
  <Num n={3} x={42} y={190} />
  <Num n={4} x={42} y={112} />
</Frame>
