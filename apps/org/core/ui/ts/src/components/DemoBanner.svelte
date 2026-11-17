<script lang="ts">
  import ArrowCounterClockwise from 'phosphor-svelte/lib/ArrowCounterClockwise'
  import LinkSimple from 'phosphor-svelte/lib/LinkSimple'
  import Timer from 'phosphor-svelte/lib/Timer'
  import { tick } from 'svelte'
  import { tip } from '../attachments/tip.ts'
  import { useCountdown } from '../hooks/useCountdown.ts'
  import { useDismiss } from '../hooks/useDismiss.ts'
  import { useInvite } from '../hooks/useInvite.ts'
  import { Plus, TestTube, X } from '../icons.ts'
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
  // where a browser holds none. The page using it pads its own foot by
  // `--demo-banner-h`, which this sets as it mounts, so the strip hides
  // nothing; dismissed, the strip is gone and a small watermark takes
  // its corner instead, which brings it back (`DismissState`); the page
  // pads by `--demo-watermark-h` instead, set the same way. The idle
  // warning brings the strip back on its own.
  let { copy = 0, ends = 0, join = '' }: { copy?: number; ends?: number; join?: string } = $props()

  const id = $props.id()
  const countdown = useCountdown(
    () => copy,
    () => ends,
  )
  const invite = useInvite()
  const dismiss = useDismiss(() => countdown.warn)

  // Hides or shows the strip and hands the keyboard focus to the control
  // that replaces the one pressed, so a key press never loses it.
  async function swap(change: () => void, next: string) {
    change()
    await tick()
    document.querySelector<HTMLElement>(next)?.focus()
  }

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

  // The watermark the strip is dismissed to sits in its own corner, not
  // flush with the viewport's foot, so its reach from the foot is its
  // distance from the viewport's bottom, not its own height alone.
  function reserveWatermark(node: HTMLElement) {
    const root = node.ownerDocument.documentElement
    const view = node.ownerDocument.defaultView ?? window
    const set = () => root.style.setProperty('--demo-watermark-h', `${view.innerHeight - node.getBoundingClientRect().top}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(node)
    return () => {
      ro.disconnect()
      root.style.removeProperty('--demo-watermark-h')
    }
  }
</script>

<!-- One countdown for the strip and its watermark alike: attached here,
     it is never started again by a swap between them, which would end
     the idle warning that brought the strip back. -->
<div class="banner" {@attach countdown.run}>
{#if !dismiss.hidden}
  <div class="demo" role="note" {@attach reserve}>
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
    <span class="hide">
      <Button tone="quiet" aria-label="Hide the demo banner" onclick={() => swap(() => dismiss.hide(), '.watermark .show button')}><Icon icon={X} size="0.95em" /></Button>
    </span>
  </div>
{:else}
  <p class="watermark" {@attach reserveWatermark}>
    <Icon icon={TestTube} size="1rem" />
    <span>Prototype</span>
    {#if countdown.active}
      <span class="timer" class:warn={countdown.warn}>
        <Icon icon={Timer} size="0.95em" />
        <time>{countdown.left}</time>
      </span>
    {/if}
    <span class="show">
      <Button tone="quiet" aria-label="Show the demo banner" onclick={() => swap(() => dismiss.show(), '.demo .hide button')}><Icon icon={Plus} size="0.95em" /></Button>
    </span>
  </p>
{/if}
</div>

<style>
  .banner {
    display: contents;
  }
  .demo {
    position: fixed;
    inset-inline: 0;
    bottom: 0;
    z-index: 20;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    /* Padding, row gap and the buttons below are each 20% shorter than
       before (var(--space-2), 0.5rem, is now 0.4rem; the buttons' 2rem
       is 1.6rem): the strip's measured offsetHeight goes from 48px to
       38px, 20% less tall. */
    gap: 0.4rem var(--space-3);
    margin: 0;
    padding: 0.4rem var(--space-3);
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
  /* The strip's buttons, 20% shorter than Button's own 2rem, in step
     with the padding and gap above. */
  .actions :global(.button),
  .hide :global(.button),
  .show :global(.button) {
    height: 1.6rem;
  }
  /* The close button: square, no label, the strip's own quiet amber. */
  .hide :global(.button) {
    padding: 0;
    width: 1.6rem;
    justify-content: center;
    background: none;
    color: var(--warning-text);
  }
  .hide :global(.button:hover) {
    background: oklch(var(--shade-4) var(--tone-warning) / 35%);
  }
  /* A subtle watermark where the strip is dismissed: the bottom of the
     drawer (the frame's own right column, `PageFrame.svelte`), since it
     sits flush with the viewport's corner; where a page has none, or it
     is shut, the same corner is the content's own. */
  .watermark {
    position: fixed;
    right: var(--space-4);
    bottom: var(--space-3);
    z-index: 20;
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    margin: 0;
    color: var(--text-subtle);
    font-size: var(--text-xs);
  }
  .show :global(.button) {
    padding: 0;
    width: 1.6rem;
    justify-content: center;
  }
</style>
