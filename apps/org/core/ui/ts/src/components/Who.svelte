<script lang="ts">
  import HardDrives from 'phosphor-svelte/lib/HardDrives'
  import LockSimple from 'phosphor-svelte/lib/LockSimple'
  import Scales from 'phosphor-svelte/lib/Scales'
  import type { Who } from '../models/settings.ts'
  import Icon from './Icon.svelte'

  // Who changes a setting, beside its label: a quiet icon, the motions'
  // scales where a circle changes it by motion, the same in the accent
  // where the reader's change waits among the changes to propose, a host's
  // drives where a host sets it, a lock where nothing the reader may write
  // changes it. Its name says it in a few words and its tooltip explains,
  // shown as the pointer rests on it or the keyboard focuses it, and read
  // as its description by assistive technology; Escape hides it.
  let { who }: { who: Who } = $props()

  const id = $props.id()
  const icons = { motion: Scales, proposed: Scales, host: HardDrives, locked: LockSimple }

  // The tooltip in the top layer, under the icon, kept inside the window.
  const tip = (el: HTMLElement) => {
    const button = el.previousElementSibling as HTMLElement
    const margin = 8
    const show = () => {
      if (!el.matches(':popover-open')) {
        el.showPopover()
      }
      const r = button.getBoundingClientRect()
      const w = el.offsetWidth
      el.style.left = `${Math.max(margin, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - margin - w))}px`
      el.style.top = `${r.bottom + 6}px`
    }
    const hide = () => {
      if (el.matches(':popover-open')) {
        el.hidePopover()
      }
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && el.matches(':popover-open')) {
        e.stopPropagation()
        hide()
      }
    }
    for (const [type, fn] of [['pointerenter', show], ['focus', show], ['pointerleave', hide], ['blur', hide]] as const) {
      button.addEventListener(type, fn)
    }
    button.addEventListener('keydown', key)
    return () => {
      hide()
      for (const [type, fn] of [['pointerenter', show], ['focus', show], ['pointerleave', hide], ['blur', hide]] as const) {
        button.removeEventListener(type, fn)
      }
      button.removeEventListener('keydown', key)
    }
  }
</script>

<span class="who">
  <button type="button" class="icon {who.kind}" aria-label={who.label} aria-describedby="{id}-tip" data-who={who.kind}>
    <Icon icon={icons[who.kind]} size="0.95rem" />
  </button>
  <span class="tip" id="{id}-tip" role="tooltip" popover="manual" {@attach tip}>
    <strong>{who.label}</strong>
    {#if who.text}<span>{who.text}</span>{/if}
  </span>
</span>

<style>
  .who {
    display: inline-flex;
    align-items: center;
  }
  .icon {
    display: grid;
    place-items: center;
    width: 1.25rem;
    height: 1.25rem;
    padding: 0;
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text-subtle);
    cursor: help;
  }
  .icon:hover {
    background: var(--hover);
    color: var(--text);
  }
  .icon.proposed {
    color: var(--accent-text);
  }
  .tip {
    position: fixed;
    inset: auto;
    margin: 0;
    max-width: 18rem;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: var(--float);
    color: var(--text);
    box-shadow: var(--shadow-float);
    font-size: var(--text-xs);
    line-height: 1.45;
  }
  .tip:popover-open {
    display: grid;
    gap: 2px;
  }
  .tip strong {
    font-weight: 600;
  }
  .tip span {
    color: var(--text-muted);
  }
</style>
