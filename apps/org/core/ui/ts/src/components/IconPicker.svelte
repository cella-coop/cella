<script lang="ts">
  import { untrack } from 'svelte'
    import CaretUpDown from 'phosphor-svelte/lib/CaretUpDown'
  import { recordIcon } from '../record-icons.ts'
  import { inked, inkOf } from '../models/ink.ts'
  import { usePicker } from '../hooks/usePicker.ts'
  import { useForm } from '../hooks/useForm.ts'
  import Icon from './Icon.svelte'
  import IconGrid from './IconGrid.svelte'
  import Popover from './Popover.svelte'

  // A record's own icon, picked from the curated set
  // (`record-icons.ts`) in a searchable grid, in the app's own Popover: a
  // "None" choice clears it, drawing the collection's icon instead, as
  // elsewhere. Posts as a plain field of the name `name`, empty for none,
  // read into `null` by the slice's form.
  let {
    value,
    name,
    label,
    title,
  }: {
    // Its initial value, from the record read; the picker holds the
    // choice from there, so a page needs no state of its own.
    value: string | null
    name: string
    label: string
    // The record's own words, to seed the ink its mark wears: its title,
    // the same ink wherever else it is shown.
    title: string
  } = $props()

  // Read once: the picker holds the choice from here on, so a later
  // change of the prop (the page's data, reread) does not reach back in.
  const form = useForm()
  const posted = $derived(form.name(name))
  const picker = usePicker(untrack(() => value))
  const chosen = $derived(recordIcon(picker.chosen))
  const ink = $derived(inkOf(title))
</script>

<input type="hidden" name={posted} value={picker.chosen ?? ''} />
<Popover label={label} wide>
  {#snippet trigger()}
    <span class="swatch" class:inked={!!chosen} style={chosen ? inked(ink) : undefined}>
      {#if chosen}<Icon icon={chosen} />{:else}<Icon icon={CaretUpDown} />{/if}
    </span>
    <span>{label}</span>
  {/snippet}
  <IconGrid value={picker.chosen} onpick={(slug) => picker.pick(slug)} />
</Popover>

<style>
  .swatch {
    display: inline-flex;
    flex: none;
    color: var(--text-muted);
  }
  .swatch.inked {
    color: var(--mark);
  }
</style>
