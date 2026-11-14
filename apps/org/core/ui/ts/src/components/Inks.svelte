<script lang="ts">
  import type { Component } from 'svelte'
  import { HUES, inkOf, inked, nth, pair, pairs, ratio, ROLES, type Pair } from '../models/ink.ts'
  import Badge from './Badge.svelte'
  import Button from './Button.svelte'
  import Icon from './Icon.svelte'

  // DEV ONLY. The ink specimen (`/specimens/ink`): where the brand's five
  // inks would go in the shell, each beside the same thing as the shell
  // draws it today, in both themes side by side, every text on ink with
  // its contrast. Ink marks identity and the one primary action and fills
  // no surface; the candidate tokens are laid over this page alone
  // (`models/ink.ts`), so nothing else changes colour until the operator
  // has reviewed it.
  type Collection = { title: string; icon: Component<any> }
  type Area = { name: string; collections: Collection[] }
  let {
    areas,
    names,
    actions,
    record,
  }: {
    // The sidebar's sections, each taking its ink in turn.
    areas: Area[]
    // Circles and people, each its ink seeded by its name.
    names: string[]
    // The page's one primary write and a secondary one beside it.
    actions: [string, string]
    // A record named in a text, its icon its collection's.
    record: Collection
  } = $props()

  const themes = [
    { name: 'Light', theme: 'light', t: 1 },
    { name: 'Dark', theme: 'dark', t: -1 },
  ] as const
  const lead = nth(0)
  const selected = $derived(areas[0]?.collections[0]?.title)
  const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  const said = (p: Pair) => `${ratio(p.ratio)}${p.ratio >= p.floor ? '' : ' (under AA)'}`
  const columns = pairs(0, 1).map((p) => p.what)
</script>

{#snippet nav(inks: boolean)}
  <div class="nav">
    {#each areas as area, k (area.name)}
      <p class="group">{area.name}</p>
      <ul>
        {#each area.collections as c (c.title)}
          <li class:on={c.title === selected} style={inks ? inked(nth(k)) : undefined}>
            <span class="glyph" class:mark={inks}><Icon icon={c.icon} /></span>{c.title}
          </li>
        {/each}
      </ul>
    {/each}
  </div>
{/snippet}

<div class="inks">
  {#each themes as { name, theme, t } (theme)}
    <section class="theme" data-theme={theme} aria-label="{name} theme">
      <h2>{name}</h2>
      <div class="grid">
        <span></span><span class="head">Today</span><span class="head">Proposed</span>

        <span class="what">The one primary action, a secondary beside it</span>
        <div class="actions">
          <Button tone="primary">{actions[0]}</Button>
          <Button>{actions[1]}</Button>
        </div>
        <div>
          <div class="actions inked" style={inked(lead)}>
            <Button tone="primary">{actions[0]}</Button>
            <span class="wash"><Button>{actions[1]}</Button></span>
          </div>
          <p class="ratio">fill {said(pair(lead, t, 'text on fill'))} · wash {said(pair(lead, t, 'text on wash'))}</p>
        </div>

        <span class="what">The sidebar: each collection's icon in its area's ink, the selected row a wash of it</span>
        <div class="ground">{@render nav(false)}</div>
        <div>
          <div class="ground inked">{@render nav(true)}</div>
          <p class="ratio">row {said(pair(lead, t, 'body text on wash'))} · icon {said(pair(lead, t, 'mark on ground'))}</p>
        </div>

        <span class="what">The focus ring</span>
        <div><span class="field">Focused field</span></div>
        <div>
          <span class="field inked" style={inked(lead)}>Focused field</span>
          <p class="ratio">{said(pair(lead, t, 'mark on panel'))}</p>
        </div>

        <span class="what">A record chip, its icon its collection's ink</span>
        <span><span class="chip"><Icon icon={record.icon} />{record.title}</span></span>
        <div>
          <span class="chip" style={inked(lead)}><span class="mark"><Icon icon={record.icon} /></span>{record.title}</span>
          <p class="ratio">{said(pair(lead, t, 'mark on panel'))}</p>
        </div>

        <span class="what">Circles and people, each an ink seeded by its name</span>
        <div class="people">
          {#each names as n (n)}<span class="avatar" title={n}>{initials(n)}</span>{/each}
        </div>
        <div>
          <div class="people">
            {#each names as n (n)}<span class="avatar inked" style={inked(inkOf(n))} title={n}>{initials(n)}</span>{/each}
          </div>
          <p class="ratio">lowest {said(names.map((n) => pair(inkOf(n), t, 'text on wash')).sort((a, b) => a.ratio - b.ratio)[0])}</p>
        </div>

        <span class="what">What stays neutral: states keep their tones; tables, text, forms and panels wear no ink</span>
        <div class="neutral">
          <span class="badges">
            <Badge>Draft</Badge><Badge tone="accent">Open</Badge><Badge tone="positive">Paid</Badge><Badge tone="warning">Overdue</Badge><Badge tone="negative">Refused</Badge>
          </span>
          <table>
            <thead><tr><th>Invoice</th><th>Due</th></tr></thead>
            <tbody><tr><td>F-2026-031</td><td>30 Nov 2026</td></tr></tbody>
          </table>
        </div>
        <p class="same">The same as today.</p>
      </div>

      <table class="contrast">
        <caption>Every pair each ink draws, against WCAG AA: 4.5:1 for text, 3:1 for an icon or a ring</caption>
        <thead>
          <tr><th>Ink</th>{#each columns as c (c)}<th>{c}</th>{/each}</tr>
        </thead>
        <tbody>
          {#each HUES as h, i (h)}
            <tr>
              <th><span class="swatch" style={inked(i)}></span>--p{i}</th>
              {#each pairs(i, t) as p (p.what)}<td class:under={p.ratio < p.floor}>{said(p)}</td>{/each}
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="ratio">Fill {ROLES.fill.light} in both themes, wash {ROLES.wash.light} and {ROLES.wash.dark}, mark {ROLES.mark.light} and {ROLES.mark.dark}: OKLCH lightness, light then dark.</p>
    </section>
  {/each}
</div>

<style>
  .inks {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(30rem, 1fr));
    gap: var(--space-4);
    padding-inline: var(--space-3);
  }
  .theme {
    display: grid;
    gap: var(--space-4);
    align-content: start;
    padding: var(--space-4);
    border-radius: var(--radius-panel);
    background: var(--panel);
    color: var(--text);
    box-shadow: 0 0 0 1px var(--line);
  }
  h2 {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 500;
  }
  .grid {
    display: grid;
    grid-template-columns: 9rem 1fr 1fr;
    gap: var(--space-4) var(--space-3);
    align-items: start;
  }
  .head {
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--text-subtle);
  }
  .what {
    font-size: var(--text-xs);
    color: var(--text-muted);
  }
  .ratio,
  .same {
    margin: var(--space-1) 0 0;
    font-size: var(--text-2xs);
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  /* The candidates: a primary button solid in its ink, a secondary a
     wash of it, read through the roles the buttons already read. */
  .actions.inked {
    --accent-fill: var(--fill);
    --on-accent: var(--on-fill);
  }
  .wash {
    display: contents;
    --sunk: var(--wash);
    --text: var(--on-wash);
    --hover: var(--wash);
  }
  .ground {
    padding: var(--space-2);
    border-radius: var(--radius-control);
    background: var(--ground);
  }
  .nav ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .group {
    margin: 0;
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--text-subtle);
  }
  .nav li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    height: 1.9rem;
    padding: 0 var(--space-2);
    border-radius: var(--radius-control);
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
  .glyph {
    display: inline-flex;
  }
  .nav li.on {
    background: var(--hover);
    color: var(--text);
    font-weight: 500;
  }
  .inked .nav li.on {
    background: var(--wash);
  }
  .mark {
    display: inline-flex;
    color: var(--mark);
  }
  .field {
    display: inline-block;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--accent-border);
    border-radius: var(--radius-control);
    background: var(--sunk);
    font-size: var(--text-sm);
    box-shadow: var(--focus);
  }
  .field.inked {
    border-color: var(--mark);
    box-shadow: 0 0 0 2px var(--mark);
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: 0 var(--space-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text);
  }
  .people {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }
  .avatar {
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 50%;
    background: var(--sunk);
    color: var(--text-muted);
    font-size: var(--text-2xs);
    font-weight: 600;
  }
  .avatar.inked {
    background: var(--wash);
    color: var(--on-wash);
  }
  .neutral {
    display: grid;
    gap: var(--space-2);
    grid-column: 2 / span 1;
  }
  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }
  table {
    border-collapse: collapse;
    font-size: var(--text-xs);
  }
  th,
  td {
    padding: var(--space-1) var(--space-2);
    border-bottom: 1px solid var(--line);
    text-align: start;
    font-weight: 500;
  }
  th {
    color: var(--text-muted);
  }
  td {
    font-weight: 400;
  }
  .contrast {
    font-variant-numeric: tabular-nums;
  }
  .contrast caption {
    padding-bottom: var(--space-2);
    font-size: var(--text-xs);
    color: var(--text-muted);
    text-align: start;
  }
  .contrast th:first-child {
    white-space: nowrap;
  }
  .contrast td.under {
    color: var(--negative-text);
    font-weight: 600;
  }
  .swatch {
    display: inline-block;
    width: 0.75rem;
    height: 0.75rem;
    margin-inline-end: var(--space-1);
    border-radius: 3px;
    background: var(--fill);
    vertical-align: middle;
  }
</style>
