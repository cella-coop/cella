<script lang="ts">
  // A demo build's banner, on every page it serves, signed in or not: the
  // co-op is a mock, anyone may sign in as its members, whose keys anyone
  // can derive, and nothing in it is a real co-op's. `floating` sets it
  // over the content's foot, where the shell puts it, out of the way of
  // every page's own header; otherwise it sits in the flow, as the gate's.
  let { floating = false }: { floating?: boolean } = $props()
</script>

<p class="demo" class:floating role="note">
  <b>Demo</b>
  <span>A mock co-op: anyone may sign in as its members, whose keys anyone can derive. Nothing here is real.</span>
</p>

<style>
  .demo {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-2);
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-control);
    background: var(--warning-soft);
    color: var(--warning-text);
    font-size: var(--text-sm);
  }
  .demo b {
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .floating {
    position: absolute;
    left: var(--space-4);
    bottom: var(--space-3);
    max-width: min(36rem, calc(100% - 2 * var(--space-4)));
    pointer-events: none;
  }
</style>
