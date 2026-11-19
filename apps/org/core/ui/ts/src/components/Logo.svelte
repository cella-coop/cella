<script lang="ts">
  // The coop's mark in its square: its logo where its particulars mark
  // one, else its name's initial on the accent fill. The logo is an SVG
  // its assembly adopted, drawn only as an image, from a `data:` URL, so
  // no script in it runs and nothing outside it loads, whatever the guard
  // that judged it let through (`circle.logo_flaw`); never inlined.
  // Decorative: the name it stands for is always read beside it.
  let {
    name,
    logo = null,
    size = 'md',
  }: {
    name: string
    logo?: string | null
    // The sidebar's switcher and the gate, `md`; a row of its menu, `sm`.
    size?: 'sm' | 'md'
  } = $props()

  const src = $derived(logo ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logo)}` : null)
</script>

{#if src}
  <img class="logo {size}" {src} alt="" aria-hidden="true" />
{:else}
  <span class="logo {size}" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
{/if}

<style>
  .logo {
    display: grid;
    place-items: center;
    flex: none;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 7px;
    font-family: var(--font-display);
    font-weight: 500;
    font-size: var(--text-md);
    line-height: 1;
  }
  span.logo {
    background: var(--accent-fill);
    color: var(--on-accent);
  }
  .sm {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 6px;
    font-size: var(--text-sm);
  }
</style>
