<script lang="ts">
  import { inked, inkOf } from '../models/ink.ts'

  // A circle or a person, drawn as a small disc of their initials: its
  // ink seeded by their name, the same wherever they appear, as the site
  // seeds its lists (`models/ink.ts`); its text clears WCAG AA on the
  // wash in both themes. Decorative: the name it stands for is always
  // read beside it.
  let { name, size = '1.5rem' }: { name: string; size?: string } = $props()

  const initials = $derived(
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?',
  )
</script>

<span class="avatar" aria-hidden="true" style="{inked(inkOf(name))}; --size: {size}">{initials}</span>

<style>
  .avatar {
    display: grid;
    place-items: center;
    flex: none;
    width: var(--size);
    height: var(--size);
    border-radius: 50%;
    background: var(--wash);
    color: var(--on-wash);
    font-size: calc(var(--size) * 0.42);
    font-weight: 600;
    line-height: 1;
  }
</style>
