<script lang="ts">
  import CalendarBlank from 'phosphor-svelte/lib/CalendarBlank'
  import { dayPattern } from '../models/format.ts'
  import { useDate } from '../hooks/useDate.ts'
  import Icon from './Icon.svelte'

  // A day typed in the app's locale, never the browser's: what is typed
  // shows as dd/mm/yyyy and posts as an ISO day under the field's name.
  // The button beside it opens the browser's own calendar, whose pick
  // the field then shows in the locale.
  let {
    id,
    name,
    value = $bindable(''),
    required = false,
  }: { id: string; name: string; value?: string | number; required?: boolean } = $props()

  const day = useDate(
    () => value,
    (iso) => (value = iso),
  )

  function open(e: MouseEvent) {
    const picker = (e.currentTarget as HTMLElement).previousElementSibling as HTMLInputElement
    try {
      picker.showPicker()
    } catch {
      // Without a picker the day is typed.
    }
  }
</script>

<span class="date">
  <input
    {id}
    type="text"
    inputmode="numeric"
    autocomplete="off"
    placeholder={dayPattern}
    {required}
    value={day.shown}
    oninput={(e) => e.currentTarget.setCustomValidity(day.type(e.currentTarget.value))}
  />
  <input type="hidden" {name} {value} />
  <input class="picker" type="date" tabindex="-1" aria-hidden="true" {value} onchange={(e) => day.pick(e.currentTarget.value)} />
  <button type="button" class="pick" aria-label="Choose a day" onclick={open}><Icon icon={CalendarBlank} /></button>
</span>

<style>
  .date {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-width: 0;
  }
  .date input[type='text'] {
    flex: 1;
    min-width: 0;
  }
  /* The browser's calendar opens from here, beside the button, and is
     never seen itself. */
  .picker {
    width: 0;
    height: 0;
    padding: 0;
    border: 0;
    opacity: 0;
    pointer-events: none;
  }
  .pick {
    display: grid;
    place-items: center;
    height: 2rem;
    width: 2rem;
    flex: none;
    border: 0;
    border-radius: var(--radius-control);
    background: var(--sunk);
    color: var(--text-muted);
    cursor: pointer;
  }
  .pick:hover {
    color: var(--text);
  }
</style>
