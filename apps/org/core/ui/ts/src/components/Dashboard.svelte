<script lang="ts">
  import type { Format, Plot, Result } from '../models/query.ts'
  import { money, month } from '../models/format.ts'
  import Card from './Card.svelte'

  // The one dashboard: each widget's result, computed by the server, as a
  // card. A figure reads as text; a chart's bars carry their values as
  // text beside them, and a line's months and values are in a table for
  // whoever does not see it, and in each month's tooltip.
  let { results, errors = [] }: { results: Result[]; errors?: string[] } = $props()

  const show = (v: number | null, f: Format) => (v === null ? '—' : f === 'money' ? money(v) : v.toLocaleString('en-GB'))
  const top = (p: Plot) => Math.max(...p.points.map((x) => x.value), 0)
  const w = 300
  const h = 80

  // The line's path over the months, the top of the box being the largest
  // value; the area under it closes the path along the bottom.
  function line(p: Plot) {
    const max = top(p) || 1
    const n = p.points.length
    const xy = p.points.map((x, i) => [n === 1 ? w / 2 : (i / (n - 1)) * w, h - (Math.max(x.value, 0) / max) * h])
    const path = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
    return { path, area: `${path} L${xy[n - 1][0].toFixed(1)},${h} L${xy[0][0].toFixed(1)},${h} Z`, step: n === 1 ? w : w / (n - 1) }
  }
</script>

{#if errors.length}
  <ul class="errors" role="status">
    {#each errors as e (e)}<li>{e}</li>{/each}
  </ul>
{/if}

<div class="dashboard">
  {#each results as r, i (i)}
    <div class:wide={r.kind === 'chart'}>
      <Card title={r.title}>
        {#if r.kind === 'kpi'}
          <p class="figure">{show(r.value, r.format)}</p>
        {:else if r.points.length === 0}
          <p class="none">Nothing to chart</p>
        {:else if r.line}
          {const l = $derived(line(r))}
          <svg viewBox="0 0 {w} {h}" preserveAspectRatio="none" class="line" aria-hidden="true">
            <path d={l.area} class="area" />
            <path d={l.path} class="stroke" />
            {#each r.points as p, j (p.label)}
              <rect x={j * l.step - l.step / 2} y="0" width={l.step} height={h} class="hit"><title>{month(p.label)}: {show(p.value, r.format)}</title></rect>
            {/each}
          </svg>
          <p class="axis">
            <span>{month(r.points[0].label)}</span>
            <span>top {show(top(r), r.format)}</span>
            <span>{month(r.points[r.points.length - 1].label)}</span>
          </p>
          <table class="hidden">
            <caption>{r.title}</caption>
            <tbody>
              {#each r.points as p (p.label)}
                <tr><th scope="row">{month(p.label)}</th><td>{show(p.value, r.format)}</td></tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <ul class="bars">
            {#each r.points as p (p.label)}
              <li>
                <span class="label">{p.label}</span>
                <span class="track"><span class="fill" style:width="{top(r) ? (Math.max(p.value, 0) / top(r)) * 100 : 0}%"></span></span>
                <span class="value">{show(p.value, r.format)}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </Card>
    </div>
  {/each}
</div>

<style>
  .dashboard {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
    gap: var(--space-3);
  }
  .wide {
    grid-column: span 2;
  }
  @media (max-width: 700px) {
    .wide {
      grid-column: auto;
    }
  }
  .dashboard > div {
    display: grid;
  }
  .figure {
    font-family: var(--font-display);
    font-size: var(--text-2xl);
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }
  .none {
    color: var(--text-muted);
    font-size: var(--text-sm);
  }
  .bars {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-1);
    font-size: var(--text-sm);
  }
  .bars li {
    display: grid;
    grid-template-columns: minmax(5rem, 9rem) 1fr auto;
    align-items: center;
    gap: var(--space-2);
  }
  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-muted);
  }
  .track {
    height: 0.6rem;
    border-radius: var(--radius-pill);
    background: var(--sunk);
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
    border-radius: var(--radius-pill);
    background: var(--accent-fill);
  }
  .value {
    font-variant-numeric: tabular-nums;
    text-align: end;
  }
  .line {
    width: 100%;
    height: 6rem;
    overflow: visible;
  }
  .area {
    fill: var(--accent-soft);
  }
  .stroke {
    fill: none;
    stroke: var(--accent-border);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }
  .hit {
    fill: transparent;
  }
  .hit:hover {
    fill: var(--hover);
  }
  .axis {
    display: flex;
    justify-content: space-between;
    font-size: var(--text-xs);
    color: var(--text-muted);
  }
  .hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .errors {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    list-style: none;
    border-radius: var(--radius-control);
    background: var(--warning-soft);
    color: var(--warning-text);
    font-size: var(--text-sm);
  }
</style>
