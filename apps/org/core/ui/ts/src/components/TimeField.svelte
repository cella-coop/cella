<script lang="ts">
  import { tick } from 'svelte'
  import Clock from 'phosphor-svelte/lib/Clock'
  import Check from 'phosphor-svelte/lib/Check'
  import { timePattern } from '../models/time.ts'
  import { place } from '../models/place.ts'
  import { useTime } from '../hooks/useTime.ts'
  import Icon from './Icon.svelte'

  // A time of day typed on the 24-hour clock, never the browser's field:
  // what is typed (9:30, 930, 9h30) posts as `HH:MM` under the field's
  // name. The button beside it opens the field's own list of times, one
  // every quarter of an hour, in the top layer, anchored to the field and
  // flipped to stay in the viewport: it opens on the field's time, else
  // the one before it, else nine, the focus on the list; the arrows move a
  // quarter, Page Up and Down an hour, Home and End to the day's ends,
  // figures typed reach the time they start, Enter, Space or a press
  // chooses, and Escape closes it, the focus back on the button. A pick
  // replaces what is typed, drops its complaint and is announced as a
  // `change`.
  let {
    id,
    name,
    value = $bindable(''),
    required = false,
  }: { id: string; name: string; value?: string | number; required?: boolean } = $props()

  const uid = $props.id()
  const t = useTime(
    () => value,
    (time) => (value = time),
  )
  let textInput: HTMLInputElement
  let pick: HTMLButtonElement
  let list: HTMLElement

  const option = (at: number) => `${uid}-t${at}`

  async function reveal() {
    await tick()
    list?.querySelector(`#${CSS.escape(option(t.active))}`)?.scrollIntoView({ block: 'nearest' })
  }

  function ontoggle(e: ToggleEvent) {
    if (e.newState !== 'open') {
      t.close()
      return
    }
    t.start()
    if (!CSS.supports('position-anchor', '--a')) {
      tick().then(() => {
        place(list, pick, 'bottom')
        list.style.minWidth = `${textInput.getBoundingClientRect().width}px`
      })
    }
    tick().then(() => {
      list.focus()
      list.querySelector(`#${CSS.escape(option(t.active))}`)?.scrollIntoView({ block: 'center' })
    })
  }

  const hide = () => {
    if (list.matches(':popover-open')) {
      list.hidePopover()
    }
  }

  function choose(at: number) {
    const time = t.list[at]
    if (!time) {
      return
    }
    t.pick(time)
    textInput.setCustomValidity(t.complaint)
    hide()
    pick.focus()
    pick.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function onkeydown(e: KeyboardEvent) {
    const k = e.key
    if (k === 'Escape') {
      // Closes the list alone, never the dialog or the popover it sits in.
      e.preventDefault()
      e.stopPropagation()
      hide()
      pick.focus()
      return
    }
    const moves: Record<string, () => void> = {
      ArrowDown: () => t.move(1),
      ArrowUp: () => t.move(-1),
      PageDown: () => t.move(4),
      PageUp: () => t.move(-4),
      Home: () => t.to('first'),
      End: () => t.to('last'),
      Enter: () => choose(t.active),
      ' ': () => choose(t.active),
    }
    const act = moves[k] ?? (/^[\d:.h]$/.test(k) && !e.ctrlKey && !e.metaKey && !e.altKey ? () => t.figure(k) : null)
    if (act) {
      e.preventDefault()
      act()
      reveal()
    }
  }

  // Its form reset, it returns to the time it was drawn with.
  const resets = (el: HTMLInputElement) => {
    const form = el.form
    const reset = () =>
      queueMicrotask(() => {
        t.reset()
        el.value = t.shown
        el.setCustomValidity('')
      })
    form?.addEventListener('reset', reset)
    return () => form?.removeEventListener('reset', reset)
  }
</script>

<span class="time">
  <input
    {id}
    bind:this={textInput}
    {@attach resets}
    type="text"
    inputmode="numeric"
    autocomplete="off"
    placeholder={timePattern}
    {required}
    value={t.shown}
    oninput={(e) => {
      t.type(e.currentTarget.value)
      e.currentTarget.setCustomValidity(t.complaint)
    }}
    onchange={() => t.settle()}
    onkeydown={(e) => {
      if (e.key === 'ArrowDown' && e.altKey) {
        e.preventDefault()
        list.showPopover()
      }
    }}
  />
  <input type="hidden" {name} {value} />
  <button
    bind:this={pick}
    type="button"
    class="pick"
    aria-label="Choose a time"
    aria-haspopup="listbox"
    popovertarget="{uid}-list"
    style:anchor-name="--{uid}"
  >
    <Icon icon={Clock} />
  </button>
  <!-- The list holds the focus while open, naming the time the keyboard is
       on as its active descendant. -->
  <div
    bind:this={list}
    id="{uid}-list"
    popover="auto"
    role="listbox"
    aria-label="Times"
    aria-activedescendant={t.open && t.active >= 0 ? option(t.active) : undefined}
    tabindex="-1"
    class="list"
    style:position-anchor="--{uid}"
    {ontoggle}
    {onkeydown}
    onfocusout={(e) => {
      // Tab leaves the list for what follows, closing it.
      if (!list.contains(e.relatedTarget as Node | null) && e.relatedTarget !== pick) {
        hide()
      }
    }}
  >
    {#each t.list as time, at (time)}
      <!-- svelte-ignore a11y_interactive_supports_focus, a11y_click_events_have_key_events: a time is the listbox's active descendant; the listbox answers the keys -->
      <div
        role="option"
        id={option(at)}
        class="option"
        class:active={t.open && t.active === at}
        aria-selected={time === t.time}
        data-value={time}
        onclick={() => choose(at)}
        onpointermove={() => t.hover(at)}
      >
        <span class="text">{time}</span>
        <span class="check">{#if time === t.time}<Icon icon={Check} />{/if}</span>
      </div>
    {/each}
  </div>
</span>

<style>
  .time {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-width: 0;
  }
  .time input[type='text'] {
    flex: 1;
    min-width: 0;
    font-variant-numeric: tabular-nums;
  }
  .pick {
    display: grid;
    place-items: center;
    height: 2rem;
    width: 2rem;
    flex: none;
    border: 0;
    border-radius: var(--radius-control);
    background: var(--sunk);
    color: var(--text-muted);
    cursor: pointer;
  }
  .pick:hover {
    color: var(--text);
  }
  .list {
    margin: var(--space-1) 0;
    width: 7.5rem;
    max-height: min(16rem, calc(100dvh - 2 * var(--space-2)));
    overflow-y: auto;
    padding: var(--space-1);
    border: 1px solid var(--line);
    border-radius: var(--radius-float);
    background: var(--float);
    color: var(--text);
    box-shadow: var(--shadow-float);
    position-area: bottom span-left;
    position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline;
  }
  .list:popover-open {
    display: grid;
    gap: 1px;
  }
  .option {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 1.9rem;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-control);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    user-select: none;
  }
  .option.active {
    background: var(--hover);
  }
  .option[aria-selected='true'] {
    font-weight: 500;
  }
  .option .text {
    flex: 1;
  }
  .check {
    display: grid;
    place-items: center;
    flex: none;
    width: 1rem;
  }
</style>
