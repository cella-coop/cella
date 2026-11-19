<script lang="ts">
  import type { Component, Snippet } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import Info from 'phosphor-svelte/lib/Info'
  import type { Event, Link, PageLayout, Prop, Tab } from '../models/view.ts'
  import { typing } from '../models/keys.ts'
  import { abandon } from '../models/navigation.ts'
  import { inked, inkOf } from '../models/ink.ts'
  import Activity from './Activity.svelte'
  import Frame from './PageFrame.svelte'
  import Icon from './Icon.svelte'
  import ChartBar from 'phosphor-svelte/lib/ChartBar'
  import Heading from './Heading.svelte'
  import Notes from './Notes.svelte'
  import Panel from './Panel.svelte'
  import Pill from './Pill.svelte'
  import Stats from './Stats.svelte'
  import Properties from './Properties.svelte'
  import Prose from './Prose.svelte'
  import Related from './Related.svelte'
  import { useTab } from '../hooks/useTab.ts'

  // The one record page, as Linear's issue page: in the content, the
  // record's title, large, its own words where it holds them as text,
  // its free-form content, and under a hairline its Activity, oldest
  // first, with the box that adds a comment where
  // its kind takes comments; in the drawer's Details panel, its
  // properties, under the fields its slices set there, and Related on
  // the drawer itself, nothing boxed. The
  // header is a breadcrumb, the record's collection as the sidebar shows
  // it, then the record's title; its reference sits under the title.
  // The first tab, the overview, is laid out by the page's layout: in
  // `body`, the record's body, then its panels; in `panels`, its panels,
  // then the body in a Notes panel at their foot, or only its "Add a
  // note" while it holds nothing. Its slices' computed figures are one
  // panel of them, Figures, before the slices' own. A heading heads
  // content: an empty Activity, Related or Figures draws none. The
  // title, the body's text and every panel's content start at one edge,
  // the column's inset.
  let {
    eyebrow,
    title,
    icon,
    subtitle,
    summary,
    back,
    tabs = [],
    tab,
    layout = 'panels',
    wide = false,
    body,
    blank = false,
    record = title,
    properties = [],
    figures = [],
    history = [],
    related = [],
    activity = [],
    actions,
    comment,
    fields,
    children,
  }: {
    eyebrow: string
    title: string
    // The record's own icon where it has one, else its collection's;
    // drawn in the record's own ink before its title. None draws none.
    icon?: Component<any>
    // The record's reference, its id or address, quiet under its title.
    subtitle?: string
    // The record's own words, under its title on the first tab.
    summary?: string | null
    // Its collection, by the name and icon the sidebar gives it.
    back: { href: string; label: string; icon?: Component<any> }
    // The page's tabs, as pills in the header when there are two or more,
    // and the open one, whose blocks the content holds; the first is the
    // record's content, and only it shows the Activity.
    tabs?: Tab[]
    tab?: string
    // How the overview opens, and the record's body, whether it holds
    // nothing yet, and the record's address, which the Notes panel keys
    // its opening by.
    layout?: PageLayout
    // The open tab lists a collection, which takes the content's width
    // rather than the column's.
    wide?: boolean
    body?: Snippet
    blank?: boolean
    record?: string
    properties?: Prop[]
    // Its computed figures, every slice's, one panel of `Stat`s on the
    // overview: after the body in the `body` layout, first in `panels`.
    figures?: Prop[]
    // The log's four, Created, Updated and by whom, where a crowded page
    // keeps them out of its properties: its own History, at the foot.
    history?: Prop[]
    related?: Link[]
    activity?: Event[]
    actions?: Snippet
    // The box that adds a comment, under the Activity.
    comment?: Snippet
    // What the record's slices set in the Details, over its properties.
    fields?: Snippet
    children?: Snippet
  } = $props()

  const id = $props.id()
  const first = $derived(!tab || tab === tabs[0]?.id)
  // The open tab's name, which a section in it that holds nothing leaves
  // unrepeated.
  useTab(() => tabs.find((t) => t.id === tab)?.label)
  // A figure with no value says nothing; with none left there is no
  // Figures panel.
  const shown = $derived(figures.filter((f) => f.value !== null && f.value !== undefined && f.value !== ''))
  // A record a property's chip already links, as an invoice's client, is
  // not listed again in Related.
  const linked = $derived(new Set(properties.map((p) => p.href).filter(Boolean)))
  const listed = $derived(related.filter((r) => !linked.has(r.href)))

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !e.defaultPrevented && !typing(e) && !document.querySelector('dialog[open]')) {
      goto(back.href).catch(abandon)
    }
  }
</script>

<svelte:window {onkeydown} />

{#snippet details()}
  {@render fields?.()}
  <Properties items={[...properties, ...history]} />
  {#if listed.length}
    <section class="related" aria-labelledby="{id}-related">
      <Heading id="{id}-related" title="Related" count={listed.length} />
      <Related items={listed} />
    </section>
  {/if}
{/snippet}

<Frame
  {title}
  caption={eyebrow}
  {back}
  {actions}
  panels={[{ id: 'details', label: 'Details', icon: Info, body: details }]}
>
  {#snippet bar()}
    {#if tabs.length > 1}
      <nav class="tabs" aria-label="{eyebrow} tabs">
        {#each tabs as t, i (t.id)}
          <Pill href={i === 0 ? page.url.pathname : `${page.url.pathname}?tab=${t.id}`} on={t.id === tab}>{t.label}</Pill>
        {/each}
      </nav>
    {/if}
  {/snippet}
  <!-- One column of a readable width, centred in the content: the
       record's title, its body and its panels flush with its left edge;
       a tab listing a collection takes the content's width. -->
  <div class="column" class:wide>
    <hgroup>
      <h1 class="record">
        {#if icon}<span class="mark" style={inked(inkOf(title))}><Icon {icon} /></span>{/if}
        {title}
      </h1>
      {#if subtitle}<p class="reference">{subtitle}</p>{/if}
    </hgroup>
    {#if first && summary}<Prose text={summary} />{/if}
    {#if first && layout === 'body'}{@render body?.()}{/if}
    {#if first && shown.length}
      <Panel title="Figures" icon={ChartBar}>
        <Stats items={shown} />
      </Panel>
    {/if}
    {@render children?.()}
    {#if first && layout === 'panels' && body}
      <Notes {record} {blank}>{@render body()}</Notes>
    {/if}
    {#if first && (activity.length || comment)}
      <!-- Its heading heads what happened: with no event and no thread
           yet, only the box that adds a comment shows. -->
      <section class="activity" class:events={activity.length > 0} aria-labelledby="{id}-activity">
        <div class="head"><Heading id="{id}-activity" title="Activity" /></div>
        {#if activity.length}<Activity items={activity} />{/if}
        {@render comment?.()}
      </section>
    {/if}
  </div>
</Frame>

<style>
  /* The page's column, as wide as a body's text and its panels, centred
     in the content, the space either side split evenly; it spaces what
     it holds as the content spaces its blocks. */
  .column {
    --inset: var(--space-4);
    display: grid;
    align-content: start;
    gap: var(--space-4);
    width: 100%;
    max-width: 48rem;
    margin-inline: auto;
    min-width: 0;
  }
  .column > :global(*) {
    min-width: 0;
  }
  .wide {
    max-width: none;
  }
  .tabs {
    display: flex;
    gap: var(--space-1);
  }
  .record {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-2xl);
    padding-inline: var(--inset);
    overflow-wrap: anywhere;
  }
  hgroup {
    display: grid;
    gap: var(--space-1);
  }
  .reference {
    padding-inline: var(--inset);
    color: var(--text-muted);
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
  }
  .mark {
    display: inline-flex;
    flex: none;
    color: var(--mark);
  }
  /* The Activity under a hairline, under the one heading. A thread is
     the comment block's own, which only it knows it holds: its
     conversations show the heading as the events do. */
  .activity {
    display: grid;
    gap: var(--space-3);
    margin-top: var(--space-2);
    padding: var(--space-4) var(--inset) 0;
    border-top: 1px solid var(--line);
  }
  .activity:not(.events):not(:has([data-conversation])) > .head {
    display: none;
  }
  /* Related under the one heading, a small gap under it as under each of
     the Properties' sections. */
  .related {
    display: grid;
    gap: var(--space-2);
    margin-top: var(--space-3);
    padding-inline: var(--inset, 0);
  }
  .related:first-child {
    margin-top: 0;
  }
</style>
