<script lang="ts">
  import ArrowCounterClockwise from 'phosphor-svelte/lib/ArrowCounterClockwise'
  import LinkSimple from 'phosphor-svelte/lib/LinkSimple'
  import Timer from 'phosphor-svelte/lib/Timer'
  import { tip } from '../attachments/tip.ts'
  import { useCountdown } from '../hooks/useCountdown.ts'
  import { useInvite } from '../hooks/useInvite.ts'
  import { TestTube } from '../icons.ts'
  import Button from './Button.svelte'
  import Icon from './Icon.svelte'

  // A demo build's banner, one fixed strip along the viewport's bottom, on
  // every page it serves, signed in or not: that this is a prototype for
  // demo purposes and no place for real work, and that its co-op is a
  // mock anyone may sign in to, behind its tooltip. On a visitor's
  // copy, now a room, which `cella demo serve` serves (`copy`, the
  // seconds idle before it resets, `ends`, when its lifetime ends once a
  // member has signed in, 0 before then, and `join`, its link's code),
  // also the time left, where either is close enough to show
  // (`CountdownState`); Reset now, a post the front answers with a fresh
  // copy, refused while another browser is still in the room; and Copy
  // invite, whose link resolves to the room another browser opens it
  // from, copied to the clipboard, or opened as the join page itself
  // where a browser holds none. It is never dismissed. The page using it
  // pads its own foot by `--demo-banner-h`, which this sets as it
  // mounts, so the strip hides nothing.
  let { copy = 0, ends = 0, join = '' }: { copy?: number; ends?: number; join?: string } = $props()

  const id = $props.id()
  const countdown = useCountdown(
    () => copy,
    () => ends,
  )
  const invite = useInvite()

  // Copies the room's link, so another browser that opens it joins as one
  // of this room's members; `invite.copied` confirms it, briefly.
  function copyInvite(e: MouseEvent) {
    void invite.copy(new URL(`/_demo/join#${join}`, location.href).href, e)
  }

  // Reserves this strip's own height at the foot of the page it sits on,
  // so the page's own padding never guesses it; sized again as it wraps.
  function reserve(node: HTMLElement) {
    const root = node.ownerDocument.documentElement
    const set = () => root.style.setProperty('--demo-banner-h', `${node.offsetHeight}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(node)
    return () => {
      ro.disconnect()
      root.style.removeProperty('--demo-banner-h')
    }
  }
</script>

<div class="demo" role="note" {@attach countdown.run} {@attach reserve}>
  <span class="about">
    <button type="button" class="trigger" aria-describedby="{id}-tip">
      <Icon icon={TestTube} />
      <span>Prototype · mock co-op</span>
    </button>
    <span class="tip" id="{id}-tip" role="tooltip" popover="manual" {@attach tip}>
      <span
        >Lanterne is a mock co-op: anyone may sign in as its members, whose keys anyone can derive.{#if copy}
          This copy of it is yours alone to share; it resets after {countdown.span} idle.{/if}</span
      >
      <span>This is a prototype environment for demo purposes and can't be used for real work.</span>
    </span>
  </span>
  {#if countdown.active}
    <span class="timer" class:warn={countdown.warn}>
      <Icon icon={Timer} />
      <time>{countdown.left}</time>
    </span>
  {/if}
  <span class="actions">
    {#if copy}
      <form method="post" action="/_demo/reset">
        <Button tone="quiet" type="submit"><Icon icon={ArrowCounterClockwise} size="0.95em" />Reset</Button>
      </form>
    {/if}
    {#if join}
      <Button tone="primary" href="/_demo/join#{join}" onclick={copyInvite}><Icon icon={LinkSimple} size="0.95em" />{invite.copied ? 'Copied' : 'Copy invite'}</Button>
    {/if}
  </span>
</div>

<style>
  .demo {
    position: fixed;
    inset-inline: 0;
    bottom: 0;
    z-index: 20;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    margin: 0;
    padding: var(--space-2) var(--space-3);
    background: var(--warning-soft);
    color: var(--warning-text);
    font-size: var(--text-sm);
  }
  .about {
    display: inline-flex;
    align-items: center;
  }
  .trigger {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    cursor: help;
  }
  .tip {
    position: fixed;
    inset: auto;
    margin: 0;
    max-width: 24rem;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: var(--float);
    color: var(--text);
    box-shadow: var(--shadow-float);
    font-size: var(--text-xs);
    font-weight: 400;
    text-transform: none;
    letter-spacing: normal;
    line-height: 1.45;
  }
  .tip:popover-open {
    display: grid;
    gap: var(--space-1);
  }
  .timer {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-variant-numeric: tabular-nums;
  }
  .timer.warn {
    color: var(--negative-text);
    font-weight: 600;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-inline-start: auto;
  }
  .actions :global(form) {
    display: contents;
  }
  /* Both buttons wear the strip's amber: Reset quiet, in a dim outline,
     and Copy invite the one bright fill, so it reads first. Copy
     invite's fill and label are fixed, not shaded by theme, so the
     label keeps about 8:1 on it in light and dark alike. */
  .actions :global(.button.quiet) {
    background: oklch(var(--shade-4) var(--tone-warning) / 35%);
    border-color: oklch(var(--shade-6) var(--tone-warning));
    color: var(--warning-text);
  }
  .actions :global(.button.quiet:hover) {
    background: oklch(var(--shade-4) var(--tone-warning) / 60%);
  }
  .actions :global(.button.primary) {
    background: oklch(0.8 0.15 80);
    color: oklch(0.25 0.05 80);
  }
</style>
