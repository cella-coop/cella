<script lang="ts">
  import type { Component } from 'svelte'
  import Calendar from 'phosphor-svelte/lib/Calendar'
  import Plus from 'phosphor-svelte/lib/Plus'
  import type { Kind, Prop } from '../models/view.ts'
  import { show } from '../models/format.ts'
  import { inked, inkOf } from '../models/ink.ts'
  import { useProps } from '../hooks/useProps.ts'
  import { useShell } from '../hooks/useShell.ts'
  import Avatar from './Avatar.svelte'
  import Cell from './Cell.svelte'
  import Icon from './Icon.svelte'
  import Pick from './Pick.svelte'
  import Popover from './Popover.svelte'
  import PropEdit from './PropEdit.svelte'

  // The drawer's properties as Linear's: a Properties section of lines,
  // each an icon and its value, its name on hover and for a screen reader
  // and drawn only where the value cannot say what it is (a figure, a
  // count, a phrase); a press opens the popover that changes it, where it
  // can be changed. The record's dates sit in a section of their own, the
  // log's four in one quiet footer line. A property with no value is not
  // listed, but Add property offers the ones that can be set; a section
  // with nothing in it does not render.
  let { items, part = 'main' }: { items: Prop[]; part?: 'main' | 'foot' } = $props()
  const shell = useShell()
  const id = $props.id()

  const stamp = ['Created', 'Updated', 'Created by', 'Updated by']
  const said: Kind[] = ['money', 'number', 'text', 'title', 'mono']
  const empty = (p: Prop) => (p.people ? p.people.length === 0 : show(p.value, p.kind) === '—')

  // The collection a property's link is a record of, where it is one:
  // `/<collection>/<id>`, whose icon its value wears.
  const record = (href: string | undefined) => href?.match(/^\/([\w-]+)\/[^/?#]+$/)?.[1]
  const said_ = (p: Prop) => !p.people && !p.icon && !record(p.href) && said.includes(p.kind ?? 'text')

  // Added: the empty properties the reader asked for, shown for the
  // popover that sets each, opened as it is added.
  const state = useProps()
  const offered = $derived(items.filter((p) => empty(p) && p.edit && !stamp.includes(p.label) && !state.added.includes(p.label)))
  const live = $derived(items.filter((p) => !empty(p) || state.added.includes(p.label)))
  const log = $derived(live.filter((p) => stamp.includes(p.label)))
  const rest = $derived(live.filter((p) => !stamp.includes(p.label)))
  const dates = $derived(rest.filter((p) => p.kind === 'date' && !empty(p)))
  const plain = $derived(rest.filter((p) => !dates.includes(p)))

  const groups = $derived.by(() => {
    const out: { name: string | null; items: Prop[] }[] = []
    for (const p of plain) {
      const name = p.group ?? null
      let g = out.find((g) => g.name === name)
      if (!g) {
        g = { name, items: [] }
        out.push(g)
      }
      g.items.push(p)
    }
    return out
  })

  const name = (a: string) => shell.name(a) ?? a
  const get = (label: string) => log.find((p) => p.label === label)
  const day = (p: Prop | undefined) => (p ? show(p.value, 'date') : null)
  const by = (p: Prop | undefined) => (p ? name(String(p.value)) : null)
  const line = (when: string, who: string, verb: string) => {
    const w = day(get(when))
    const a = by(get(who))
    return w || a ? [verb, w, a ? `by ${a}` : null].filter(Boolean).join(' ') : null
  }
  const footer = $derived([line('Created', 'Created by', 'Created'), line('Updated', 'Updated by', 'Updated')].filter(Boolean).join(' · '))

  const glyph = (p: Prop): Component<any> | undefined => (p.kind === 'date' ? Calendar : undefined)
  const add = (v: string | string[]) => state.add(Array.isArray(v) ? v[0] : v)
</script>

{#snippet value(p: Prop)}
  {#if empty(p)}
    <span class="blank">{p.label}</span>
  {:else}
    {const g = glyph(p)}
    {#if p.icon}
      <span class="mark inked" style={inked(inkOf(p.ink ?? p.label))} aria-hidden="true"><Icon icon={p.icon} size="1em" /></span>
    {:else if g}
      <span class="mark" aria-hidden="true"><Icon icon={g} size="1em" /></span>
    {/if}
    {#if said_(p)}<span class="name">{p.label}</span>{/if}
    {#if p.people}
      <span class="crew" aria-hidden="true">
        {#each p.people.slice(0, 4) as a (a)}<Avatar name={name(a)} size="1.25rem" />{/each}
      </span>
      <span class="who">{p.people.map(name).join(', ')}</span>
    {:else if p.kind === 'person'}
      <Avatar name={name(String(p.value))} size="1.25rem" />
      {#if p.href}
        <a class="who" href={p.href} onclick={(e) => e.stopPropagation()}>{name(String(p.value))}</a>
      {:else}
        <span class="who">{name(String(p.value))}</span>
      {/if}
    {:else if p.icon}
      <span class="who">{show(p.value, p.kind)}</span>
    {:else if p.href}
      <a href={p.href} onclick={(e) => e.stopPropagation()}><Cell value={p.value} kind={p.kind} tone={p.tone} record={record(p.href)} /></a>
    {:else}
      <Cell value={p.value} kind={p.kind} tone={p.tone} />
    {/if}
  {/if}
{/snippet}

{#snippet row(p: Prop)}
  <li class="row">
    {#if p.edit}
      <Popover label={p.label} menu={false} wide open={state.fresh === p.label} onclose={() => (state.fresh = null)}>
        {#snippet trigger()}
          <span class="line" title={p.label}>
            <span class="visually-hidden">{p.label}: </span>
            {@render value(p)}
          </span>
        {/snippet}
        <PropEdit edit={p.edit} label={p.label} />
      </Popover>
    {:else}
      <span class="line plain" title={p.label}>
        <span class="visually-hidden">{p.label}: </span>
        {@render value(p)}
      </span>
    {/if}
  </li>
{/snippet}

{#if part === 'main' && (groups.length || offered.length)}
  <section class="sect" aria-labelledby="{id}-props">
    <h2 id="{id}-props">Properties</h2>
    {#each groups as g (g.name)}
      <ul class="props">
        {#each g.items as p (p.label)}{@render row(p)}{/each}
      </ul>
    {/each}
    {#if offered.length}
      <Popover label="Add property" menu={false}>
        {#snippet trigger()}
          <span class="line add"><span class="mark" aria-hidden="true"><Icon icon={Plus} size="1em" /></span>Add property</span>
        {/snippet}
        <Pick label="Add property" options={offered.map((p) => ({ value: p.label, label: p.label }))} value="" onpick={add} />
      </Popover>
    {/if}
  </section>
{/if}

{#if part === 'main' && dates.length}
  <section class="sect" aria-labelledby="{id}-dates">
    <h2 id="{id}-dates">Dates</h2>
    <ul class="props">
      {#each dates as p (p.label)}{@render row(p)}{/each}
    </ul>
  </section>
{/if}

{#if part === 'foot' && footer}
  <p class="foot">{footer}</p>
{/if}

<style>
  .sect {
    display: grid;
    gap: var(--space-1);
    padding-inline: var(--inset, 0);
  }
  .sect:not(:first-child),
  .foot {
    margin-top: var(--space-3);
  }
  h2 {
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text-muted);
    letter-spacing: normal;
    margin: 0 0 var(--space-1);
  }
  .props {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
    font-size: var(--text-sm);
  }
  .props + .props {
    margin-top: var(--space-2);
  }
  .row {
    min-width: 0;
  }
  .line {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    min-height: 1.75rem;
    line-height: 1.5;
    font-size: var(--text-sm);
  }
  .plain {
    padding: var(--space-1);
  }
  .line > :global(*:not(.mark):not(.crew)) {
    min-width: 0;
  }
  .mark {
    display: inline-flex;
    flex: none;
    color: var(--text-muted);
  }
  .mark.inked {
    color: var(--mark);
  }
  .name {
    color: var(--text-muted);
  }
  .blank {
    color: var(--text-subtle);
  }
  .who {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .crew {
    display: inline-flex;
    flex: none;
  }
  .crew > :global(* + *) {
    margin-inline-start: -0.35rem;
    box-shadow: 0 0 0 2px var(--float, var(--bg));
  }
  .add {
    color: var(--text-subtle);
  }
  a:hover {
    text-decoration: underline;
    text-decoration-color: var(--accent-border);
  }
  /* Who touched the record, quieter than what it is: the drawer's last
     word, never its first. */
  .foot {
    margin-block-end: 0;
    padding-inline: var(--inset, 0);
    font-size: var(--text-xs);
    color: var(--text-subtle);
  }
</style>
