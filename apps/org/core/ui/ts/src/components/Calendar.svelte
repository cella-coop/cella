<script lang="ts">
  import CaretLeft from 'phosphor-svelte/lib/CaretLeft'
  import CaretRight from 'phosphor-svelte/lib/CaretRight'
  import type { Column } from '../models/view.ts'
  import { under, type Field } from '../models/query.ts'
  import { legend, placed, time, type Period } from '../models/calendar.ts'
  import { inked } from '../models/ink.ts'
  import Cell from './Cell.svelte'
  import Group from './Group.svelte'
  import Icon from './Icon.svelte'

  // The one calendar: the rows on the days of a month, as weeks from
  // Monday, or of one week, placed by a date field, each entry its time
  // when the date holds one and its title, tinted by the first of the
  // view's fields that has a tone. Grouped by a field, each entry is
  // tinted instead by its value's ink, and a legend over the days names
  // each value, its colour and how many of the rows shown hold it, so no
  // value is told by colour alone. A week shows the view's fields under
  // each title. The arrows and Today are links, so where the viewer is
  // stays in the address.
  let {
    rows,
    on,
    period,
    titled,
    shown,
    href,
    link,
    sorted = false,
    by,
    order = [],
  }: {
    rows: any[]
    on: Field
    period: Period
    titled: Column
    shown: Column[]
    href?: (row: any) => string | undefined
    // The address of the period around a day.
    link: (day: string | null) => string
    // Whether the view sorts the rows, so each day keeps the order they
    // came in rather than their time's.
    sorted?: boolean
    // The field the view groups the rows by, which colours each entry,
    // and its values in its board's order, which hands out the inks.
    by?: Column
    order?: string[]
  } = $props()

  const days = $derived(placed(rows, on, period, sorted))
  const toned = $derived(shown.find((c) => c.tone))
  const keys = $derived(by ? legend([...days.values()].flat(), by.key, order) : [])
  const inks = $derived(new Map(keys.map((k) => [k.value, k.ink])))
  // An entry's ink, its value's; none where the rows are not grouped or
  // it holds no value.
  const ink = (row: any): number | null => (by ? (inks.get(under(row, by.key)) ?? null) : null)
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const number = (day: string) => Number(day.slice(8, 10))
</script>

<div class="calendar {period.span}">
  <div class="head">
    <h2>{period.label}</h2>
    <nav aria-label="Period">
      <a href={link(period.prev)} aria-label="Previous {period.span}" title="Previous {period.span}"><Icon icon={CaretLeft} /></a>
      <a href={link(null)} class="today">Today</a>
      <a href={link(period.next)} aria-label="Next {period.span}" title="Next {period.span}"><Icon icon={CaretRight} /></a>
    </nav>
  </div>
  {#if by && keys.length}
    <ul class="legend" aria-label="By {by.label.toLowerCase()}">
      {#each keys as k (k.value)}
        <li style={k.ink === null ? undefined : inked(k.ink)} class:inked={k.ink !== null}>
          <span class="swatch" aria-hidden="true"></span>
          <Group {by} row={k.row} value={k.value} count={k.count} />
        </li>
      {/each}
    </ul>
  {/if}
  <ol class="grid" aria-label="{period.label}, by {on.label.toLowerCase()}">
    {#each weekdays as w (w)}
      <li class="weekday" aria-hidden="true">{w}</li>
    {/each}
    {#each period.days as d (d.day)}
      {const entries = $derived(days.get(d.day) ?? [])}
      <li class="day" class:outside={!d.inside} class:today={d.today} aria-label="{d.day}, {entries.length}">
        <span class="number">{number(d.day)}</span>
        <ul>
          {#each entries as row (row.id)}
            {const to = $derived(href?.(row))}
            {const tint = $derived(ink(row))}
            <li class="entry" class:inked={tint !== null} style={tint === null ? undefined : inked(tint)} data-tone={by ? undefined : toned?.tone?.(row)}>
              {#if time(on.value(row))}<span class="time">{time(on.value(row))}</span>{/if}
              {#if to}
                <a href={to} class="title">{titled.value(row)}</a>
              {:else}
                <span class="title">{titled.value(row)}</span>
              {/if}
              {#if period.span === 'week'}
                {#each shown as c (c.key)}
                  <span class="field"><Cell value={c.value(row)} kind={c.kind} tone={c.tone?.(row)} record={c.record} /></span>
                {/each}
              {/if}
            </li>
          {/each}
        </ul>
      </li>
    {/each}
  </ol>
</div>

<style>
  .calendar {
    display: grid;
    gap: var(--space-2);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding-inline: var(--space-1);
  }
  h2 {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 500;
  }
  nav {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
  nav a {
    display: grid;
    place-items: center;
    min-width: 1.75rem;
    height: 1.75rem;
    padding: 0 var(--space-1);
    border-radius: var(--radius-control);
    color: var(--text-muted);
    font-size: var(--text-sm);
  }
  nav a:hover {
    background: var(--hover);
    color: var(--text);
  }
  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 2px;
  }
  .weekday {
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--text-subtle);
  }
  .day {
    display: grid;
    align-content: start;
    gap: var(--space-1);
    min-width: 0;
    min-height: 6.5rem;
    padding: var(--space-1);
    border-radius: var(--radius-control);
    background: var(--raised);
  }
  .week .day {
    min-height: 16rem;
  }
  .day.outside {
    background: none;
  }
  .day.outside .number {
    color: var(--text-subtle);
  }
  .number {
    justify-self: start;
    min-width: 1.4rem;
    padding: 0 var(--space-1);
    border-radius: var(--radius-pill);
    font-size: var(--text-xs);
    color: var(--text-muted);
    text-align: center;
  }
  .today .number {
    background: var(--accent-fill);
    color: var(--on-accent);
  }
  .day ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
  }
  .entry {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 var(--space-1);
    min-width: 0;
    padding: 1px var(--space-1);
    border-radius: calc(var(--radius-control) - 2px);
    background: var(--neutral-soft);
    color: var(--neutral-text);
    font-size: var(--text-xs);
  }
  .entry[data-tone='accent'] {
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  .entry[data-tone='positive'] {
    background: var(--positive-soft);
    color: var(--positive-text);
  }
  .entry[data-tone='negative'] {
    background: var(--negative-soft);
    color: var(--negative-text);
  }
  .entry[data-tone='warning'] {
    background: var(--warning-soft);
    color: var(--warning-text);
  }
  .entry.inked {
    background: var(--wash);
    color: var(--on-wash);
  }
  .legend {
    list-style: none;
    margin: 0;
    padding: 0 var(--space-1);
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-4);
  }
  .legend li {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }
  .swatch {
    flex: none;
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 3px;
    background: var(--neutral-soft);
    box-shadow: inset 0 0 0 1px var(--line);
  }
  .inked .swatch {
    background: var(--wash);
    box-shadow: inset 0 0 0 1.5px var(--mark);
  }
  .time {
    font-variant-numeric: tabular-nums;
  }
  .entry .title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: inherit;
    font-weight: 500;
  }
  .month .entry .title {
    flex: 1 1 0;
  }
  .week .entry {
    display: grid;
    padding: var(--space-1);
  }
  .week .entry .title {
    white-space: normal;
  }
  .field {
    display: flex;
    min-width: 0;
  }
  .entry a:hover {
    text-decoration: underline;
  }
</style>
