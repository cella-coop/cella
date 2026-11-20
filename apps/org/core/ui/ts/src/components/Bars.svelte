<script lang="ts">
  import { money } from '../models/format.ts'

  // A bar chart: each point a row, its label, a bar as long as its value
  // is beside the largest, and the value as text, so it reads without the
  // bars. Its heading is the panel's that holds it.
  let { points, format = 'number' }: { points: { label: string; value: number }[]; format?: 'number' | 'money' } = $props()

  const top = $derived(Math.max(...points.map((p) => p.value), 0))
  const show = (v: number) => (format === 'money' ? money(v) : v.toLocaleString('en-GB'))
</script>

<ul class="bars">
  {#each points as p (p.label)}
    <li>
      <span class="label">{p.label}</span>
      <span class="track"><span class="fill" style:width="{top ? (Math.max(p.value, 0) / top) * 100 : 0}%"></span></span>
      <span class="value">{show(p.value)}</span>
    </li>
  {/each}
</ul>

<style>
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
</style>
