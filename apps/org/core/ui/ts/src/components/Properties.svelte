<script lang="ts">
  import { onMount } from 'svelte'
  import Plus from 'phosphor-svelte/lib/Plus'
  import UsersThree from 'phosphor-svelte/lib/UsersThree'
  import CalendarPlus from 'phosphor-svelte/lib/CalendarPlus'
  import ClockCounterClockwise from 'phosphor-svelte/lib/ClockCounterClockwise'
  import { editValue, type Prop } from '../models/view.ts'
  import { show } from '../models/format.ts'
  import { none } from '../models/outcome.ts'
  import { mark, record, sections, word } from '../models/drawer.ts'
  import { glyph } from '../glyphs.ts'
  import { useProps } from '../hooks/useProps.ts'
  import { useShell } from '../hooks/useShell.ts'
  import { useWrites } from '../hooks/useWrites.ts'
  import { peek, propertyDraftId, retry, unstash } from '../hooks/drafts.svelte.ts'
  import Avatar from './Avatar.svelte'
  import Field from './Field.svelte'
  import Heading from './Heading.svelte'
  import Icon from './Icon.svelte'
  import Pick from './Pick.svelte'
  import Popover from './Popover.svelte'
  import PropEdit from './PropEdit.svelte'
  import Value from './Value.svelte'

  // The drawer's properties as Linear's: sections under the one heading,
  // Properties, then any its slices name, then Dates, each of rows of one
  // height a step in from it. Every row is a bare `Field`, its icon and
  // its value, no name shown: its name is its tooltip and its accessible
  // name (`models/drawer.ts` says which icon), and a quiet lead word
  // before the value says what a day or a phrase is ("closes 31 Oct",
  // "quorum half the seats"). An editable row is live:
  // it fills on hover and opens the popover that changes it on a press,
  // the whole row, never a pencil. The record's Created and Updated end
  // its Dates, each its day and who. A property with no value is not
  // listed, but Add property offers the ones that can be set; a section
  // with nothing in it does not render. A computed figure is never here:
  // it is a `Stat` on the overview.
  let { items }: { items: Prop[] } = $props()
  const shell = useShell()
  const writes = useWrites()
  const id = $props.id()

  // A property's popover may have been accepted and the page left at
  // once, before its own signed write reached the server: what was kept
  // for this browser, this page and this field is posted again as the
  // drawer mounts, whichever property's popover made it, but only where
  // the field still reads what the draft started from; moved since, by
  // another write or another editor, it is dropped instead of
  // overwriting that newer value, which a quiet notice says.
  onMount(() => {
    for (const p of items) {
      if (!p.edit || 'block' in p.edit) {
        continue
      }
      const edit = p.edit
      const draftId = propertyDraftId(writes.actor, writes.copy, location.pathname, edit.field)
      const draft = peek(draftId)
      if (!draft) {
        continue
      }
      if (draft.was !== editValue(edit)) {
        unstash(draftId, draft.token)
        writes.done = { op: none, state: 'failed', reason: `${p.label} changed since: the kept edit was dropped`, then: [] }
        continue
      }
      retry(draftId, draft, (write, fields) => writes.shown(writes.send(write, fields)))
    }
  })

  const stamp = ['Created', 'Updated', 'Created by', 'Updated by']
  const empty = (p: Prop) => (p.people ? p.people.length === 0 : show(p.value, p.kind) === '—')

  // Added: the empty properties the reader asked for, shown for the
  // popover that sets each, opened as it is added.
  const state = useProps()
  const offered = $derived(items.filter((p) => empty(p) && p.edit && !stamp.includes(p.label) && !state.added.includes(p.label)))
  const live = $derived(items.filter((p) => !empty(p) || state.added.includes(p.label)))
  const log = $derived(live.filter((p) => stamp.includes(p.label)))

  // The log's stamps, rows of Dates as any date is: when, then who.
  const name = (a: string) => shell.name(a) ?? a
  const get = (label: string) => log.find((p) => p.label === label)
  const stamps = $derived(
    [
      ['Created', 'Created by', CalendarPlus],
      ['Updated', 'Updated by', ClockCounterClockwise],
    ]
      .map(([when, who, icon]) => ({ label: when as string, icon: icon as typeof CalendarPlus, when: get(when as string), who: get(who as string) }))
      .filter((s) => s.when || s.who),
  )

  // Properties holds Add property, and Dates the stamps, even where no
  // other row would make them.
  const laid = $derived.by(() => {
    const out = sections(live.filter((p) => !stamp.includes(p.label)))
    if (offered.length && !out.some((s) => s.name === 'Properties')) {
      out.unshift({ name: 'Properties', rows: [] })
    }
    if (stamps.length && !out.some((s) => s.name === 'Dates')) {
      out.push({ name: 'Dates', rows: [] })
    }
    return out
  })

  const add = (v: string | string[]) => state.add(Array.isArray(v) ? v[0] : v)
</script>

{#snippet crew(people: string[])}
  <span class="people">
    <span class="crew" aria-hidden="true">
      {#each people.slice(0, 4) as a (a)}<Avatar name={name(a)} size="1rem" />{/each}
    </span>
    <span class="who">{people.map(name).join(', ')}</span>
  </span>
{/snippet}

{#snippet value(p: Prop)}
  {#if empty(p)}
    <span class="blank">{p.label}</span>
  {:else if p.people}
    {@render crew(p.people)}
  {:else if p.icon}
    <span class="who">{show(p.value, p.kind)}</span>
  {:else if record(p.href)}
    <!-- A record is its chip, the chip its link. -->
    <Value value={p.value} kind={p.kind} tone={p.tone} states={p.states} record={record(p.href)} href={p.href} size="drawer" />
  {:else if p.href}
    <a href={p.href} onclick={(e) => e.stopPropagation()}><Value value={p.value} kind={p.kind} tone={p.tone} states={p.states} size="drawer" /></a>
  {:else}
    <Value value={p.value} kind={p.kind} tone={p.tone} states={p.states} size="drawer" />
  {/if}
{/snippet}

{#snippet row(label: string, p: Prop)}
  {const kind = $derived(glyph(p.kind, p.lead ?? p.label))}
  {const icon = $derived(empty(p) ? (p.glyph ?? kind) : mark(p, kind, UsersThree))}
  {const lead = $derived(empty(p) ? undefined : word(p))}
  {#snippet shown()}{@render value(p)}{/snippet}
  {#if p.edit}
    {#snippet editor()}{#if p.edit}<PropEdit edit={p.edit} label={p.label} />{/if}{/snippet}
    <li>
      <Field bare live {label} {icon} {lead} href={p.href} {editor} open={state.fresh === p.label} onclose={() => (state.fresh = null)} children={shown} />
    </li>
  {:else}
    <li><Field bare readonly {label} {icon} {lead} children={shown} /></li>
  {/if}
{/snippet}

{#if laid.length}
  <div class="properties">
    {#each laid as s, i (s.name)}
      <section class="sect" aria-labelledby="{id}-{i}">
        <Heading id="{id}-{i}" title={s.name} />
        <ul class="props">
          {#each s.rows as r (r.label)}{@render row(r.label, r.prop)}{/each}
          {#if s.name === 'Dates'}
            {#each stamps as t (t.label)}
              {#snippet stamped()}
                {#if t.when}<Value value={t.when.value} kind="date" size="drawer" />{/if}
                {#if t.who}
                  <span class="people">
                    <span class="crew" aria-hidden="true"><Avatar name={name(String(t.who.value))} size="1rem" /></span>
                    <span class="who"><span class="visually-hidden">by </span>{name(String(t.who.value))}</span>
                  </span>
                {/if}
              {/snippet}
              <li class="stamp"><Field bare readonly label={t.label} icon={t.icon} lead={t.when ? t.label.toLowerCase() : `${t.label.toLowerCase()} by`} children={stamped} /></li>
            {/each}
          {/if}
          {#if s.name === 'Properties' && offered.length}
            <li class="add">
              <Popover label="Add property" menu={false}>
                {#snippet trigger()}
                  <span class="line">
                    <span class="glyph" aria-hidden="true"><Icon icon={Plus} size="1em" /></span>
                    <span>Add property</span>
                  </span>
                {/snippet}
                <Pick label="Add property" options={offered.map((p) => ({ value: p.label, label: p.label }))} value="" onpick={add} />
              </Popover>
            </li>
          {/if}
        </ul>
      </section>
    {/each}
  </div>
{/if}

<style>
  /* Sections as far apart as Related sits below them, each heading at
     the drawer's inset with a small gap under it, its rows a subtle step
     in from it and one height, their hover fill reaching a little past
     the heading's edge. */
  .properties {
    display: grid;
    row-gap: calc(var(--space-4) + var(--space-3));
    padding-inline: var(--inset, 0);
    font-size: var(--text-sm);
  }
  .sect {
    display: grid;
    row-gap: var(--space-2);
    min-width: 0;
  }
  .props {
    display: grid;
    row-gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
    min-width: 0;
  }
  .blank,
  .add {
    color: var(--text-subtle);
  }
  /* Add property is a row as any: its button fills it, its plus in the
     icons' box. */
  .add {
    margin-inline: calc(-1 * var(--space-2));
    border-radius: var(--radius-control);
  }
  .add:hover {
    background: var(--hover);
  }
  .add > :global(.trigger) {
    display: block;
    width: 100%;
    padding: 0;
    border: none;
    border-radius: inherit;
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
  }
  .add > :global(.trigger:hover) {
    background: none;
  }
  .line {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 1.875rem;
    padding-inline: calc(var(--space-2) + var(--space-3)) var(--space-2);
  }
  .glyph {
    display: inline-flex;
    flex: none;
    justify-content: center;
    width: 1rem;
  }
  .stamp :global(.value) {
    gap: var(--space-2);
  }
  .people {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }
  .who {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .crew {
    display: inline-flex;
    flex: none;
  }
  .crew > :global(* + *) {
    margin-inline-start: -0.3rem;
    box-shadow: 0 0 0 2px var(--surface);
  }
  a:hover {
    text-decoration: underline;
    text-decoration-color: var(--accent-border);
  }
</style>
