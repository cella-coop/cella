<script lang="ts">
  import { useCountdown } from '../hooks/useCountdown.ts'

  // A demo build's banner, on every page it serves, signed in or not: that
  // this is a prototype for demo purposes and no place for real work, and
  // that its co-op is a mock anyone may sign in to. On a visitor's copy,
  // now a room, which `cella demo serve` serves (`copy`, the seconds idle
  // before it resets, `ends`, when it resets however busy, and `join`,
  // its link's code), also that the copy is the visitor's own, when it
  // resets, its Reset now, a post the front answers with a fresh copy,
  // refused while another browser is still in the room, and Share this
  // copy, whose link's `href` resolves to the room another browser opens
  // it from. It is never dismissed. `floating` sets it over the content's
  // foot, where the shell puts it, out of the way of every page's own
  // header; otherwise it sits in the flow, as the gate's.
  let { floating = false, copy = 0, ends = 0, join = '' }: { floating?: boolean; copy?: number; ends?: number; join?: string } = $props()

  const countdown = useCountdown(
    () => copy,
    () => ends,
  )
</script>

<div class="demo" class:floating role="note">
  <p>
    <b>Prototype</b>
    <span>This is a prototype environment for demo purposes and can't be used for real work.</span>
  </p>
  {#if copy}
    <div class="line">
      <span
        >Lanterne is a mock co-op, and this copy of it is yours alone to share. It resets after {countdown.span} idle{#if ends}, or when
        its time runs out{/if}: <time {@attach countdown.run}>{countdown.left}</time> left.</span
      >
      <form method="post" action="/_demo/reset"><button type="submit">Reset now</button></form>
    </div>
    {#if join}
      <p class="line">
        <span
          >Share this copy: whoever opens <a href="/_demo/join?code={join}">its link</a> joins this room, as one of its members.</span
        >
      </p>
    {/if}
  {:else}
    <p><span>Lanterne is a mock co-op: anyone may sign in as its members, whose keys anyone can derive.</span></p>
  {/if}
</div>

<style>
  .demo {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-control);
    background: var(--warning-soft);
    color: var(--warning-text);
    font-size: var(--text-sm);
  }
  .demo p,
  .demo .line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-2);
    margin: 0;
  }
  .demo b {
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .demo time {
    font-variant-numeric: tabular-nums;
  }
  .demo a {
    color: inherit;
    text-decoration: underline;
  }
  .demo form {
    display: inline;
    margin: 0;
  }
  .demo button {
    font: inherit;
    font-weight: 600;
    color: inherit;
    background: transparent;
    border: 1px solid currentColor;
    border-radius: var(--radius-control);
    padding: 0 var(--space-2);
    cursor: pointer;
    pointer-events: auto;
  }
  .floating {
    position: absolute;
    left: var(--space-4);
    bottom: var(--space-3);
    max-width: min(36rem, calc(100% - 2 * var(--space-4)));
    pointer-events: none;
  }
</style>
