<script lang="ts">
  import { tick } from 'svelte'
  import CalendarBlank from 'phosphor-svelte/lib/CalendarBlank'
  import CaretLeft from 'phosphor-svelte/lib/CaretLeft'
  import CaretRight from 'phosphor-svelte/lib/CaretRight'
  import { dayPattern, local, spoken } from '../models/format.ts'
  import { period } from '../models/calendar.ts'
  import { place } from '../models/place.ts'
  import { useDate } from '../hooks/useDate.ts'
  import Icon from './Icon.svelte'

  // A day typed in the app's locale, never the browser's: what is typed
  // shows as dd/mm/yyyy and posts as an ISO day under the field's name.
  // The button beside it opens the field's own calendar, a month of days
  // in the top layer, anchored to the field and flipped to stay in the
  // viewport: it opens on the field's day, else today, the arrows moving
  // a day or a week, Home and End to the week's ends, Page Up and Down a
  // month (with Shift, a year), Enter or a press choosing, and Escape
  // closing it, the focus back on the button. A pick replaces what is
  // typed, drops its complaint and is announced as a `change`, so a
  // setting commits as it is made.
  let {
    id,
    name,
    value = $bindable(''),
    required = false,
  }: { id: string; name: string; value?: string | number; required?: boolean } = $props()

  const uid = $props.id()
  const day = useDate(
    () => value,
    (iso) => (value = iso),
  )
  let textInput: HTMLInputElement
  let pick: HTMLButtonElement
  let calendar: HTMLElement

  const month = $derived(day.at ? period(day.at, 'month', day.today) : null)
  const weeks = $derived(month ? Array.from({ length: month.days.length / 7 }, (_, w) => month.days.slice(w * 7, w * 7 + 7)) : [])
  const weekdays = [
    ['Mo', 'Monday'],
    ['Tu', 'Tuesday'],
    ['We', 'Wednesday'],
    ['Th', 'Thursday'],
    ['Fr', 'Friday'],
    ['Sa', 'Saturday'],
    ['Su', 'Sunday'],
  ]

  async function focusDay() {
    await tick()
    calendar?.querySelector<HTMLElement>(`[data-day="${day.at}"]`)?.focus()
  }

  function ontoggle(e: ToggleEvent) {
    if (e.newState !== 'open') {
      return
    }
    day.open(local(new Date()))
    if (!CSS.supports('position-anchor', '--a')) {
      tick().then(() => place(calendar, pick, 'bottom'))
    }
    focusDay()
  }

  function choose(iso: string) {
    day.pick(iso)
    textInput.setCustomValidity(day.complaint)
    calendar.hidePopover()
    pick.focus()
    pick.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function onkeydown(e: KeyboardEvent) {
    if (!(e.target as HTMLElement).dataset.day) {
      return
    }
    const moves: Record<string, () => void> = {
      ArrowLeft: () => day.step(-1),
      ArrowRight: () => day.step(1),
      ArrowUp: () => day.step(-7),
      ArrowDown: () => day.step(7),
      Home: () => day.edge('start'),
      End: () => day.edge('end'),
      PageUp: () => day.month(e.shiftKey ? -12 : -1),
      PageDown: () => day.month(e.shiftKey ? 12 : 1),
    }
    const act = moves[e.key]
    if (act) {
      e.preventDefault()
      act()
      focusDay()
    }
  }
</script>

<span class="date">
  <input
    {id}
    bind:this={textInput}
    type="text"
    inputmode="numeric"
    autocomplete="off"
    placeholder={dayPattern}
    {required}
    value={day.shown}
    oninput={(e) => {
      day.type(e.currentTarget.value)
      e.currentTarget.setCustomValidity(day.complaint)
    }}
  />
  <input type="hidden" {name} {value} />
  <button
    bind:this={pick}
    type="button"
    class="pick"
    aria-label="Choose a day"
    aria-haspopup="dialog"
    popovertarget="{uid}-calendar"
    style:anchor-name="--{uid}"
  >
    <Icon icon={CalendarBlank} />
  </button>
  <div bind:this={calendar} id="{uid}-calendar" popover="auto" role="dialog" aria-label="Calendar" class="calendar" style:position-anchor="--{uid}" {ontoggle}>
    {#if month}
      <div class="head">
        <button type="button" class="turn" aria-label="Previous month" onclick={() => day.month(-1)}><Icon icon={CaretLeft} /></button>
        <span class="month" id="{uid}-month" aria-live="polite">{month.label}</span>
        <button type="button" class="turn" aria-label="Next month" onclick={() => day.month(1)}><Icon icon={CaretRight} /></button>
      </div>
      <table role="grid" aria-labelledby="{uid}-month" {onkeydown}>
        <thead>
          <tr>
            {#each weekdays as [short, long] (long)}<th scope="col" abbr={long}>{short}</th>{/each}
          </tr>
        </thead>
        <tbody>
          {#each weeks as week (week[0].day)}
            <tr>
              {#each week as d (d.day)}
                <td aria-selected={d.day === day.day}>
                  <button
                    type="button"
                    class="day"
                    class:outside={!d.inside}
                    class:today={d.today}
                    class:chosen={d.day === day.day}
                    tabindex={d.day === day.at ? 0 : -1}
                    aria-label={spoken(d.day)}
                    aria-current={d.today ? 'date' : undefined}
                    data-day={d.day}
                    onclick={() => choose(d.day)}
                  >
                    {Number(d.day.slice(8))}
                  </button>
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</span>

<style>
  .date {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-width: 0;
  }
  .date input[type='text'] {
    flex: 1;
    min-width: 0;
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
  .calendar {
    margin: var(--space-1) 0;
    padding: var(--space-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-float);
    background: var(--float);
    color: var(--text);
    box-shadow: var(--shadow-float);
    position-area: bottom span-left;
    position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline;
  }
  .calendar:popover-open {
    display: grid;
    gap: var(--space-2);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .month {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 600;
  }
  .turn {
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    border: 0;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text-muted);
    cursor: pointer;
  }
  .turn:hover {
    background: var(--hover);
    color: var(--text);
  }
  table {
    border-collapse: collapse;
  }
  th {
    padding: 0 0 var(--space-1);
    font-size: var(--text-2xs);
    font-weight: 500;
    color: var(--text-subtle);
    text-align: center;
  }
  td {
    padding: 1px;
  }
  .day {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border: 1px solid transparent;
    border-radius: var(--radius-control);
    background: none;
    font-size: var(--text-sm);
    color: var(--text);
    cursor: pointer;
  }
  .day:hover {
    background: var(--hover);
  }
  .outside {
    color: var(--text-subtle);
  }
  .today {
    border-color: var(--line);
    font-weight: 600;
  }
  .chosen,
  .chosen:hover {
    background: var(--accent-fill);
    color: var(--on-accent);
  }
</style>
