<script lang="ts">
  import type { Tone } from '../models/view.ts'
  import { inked } from '../models/ink.ts'

  // The one dot: a state's own mark where it carries no icon, as a
  // badge's, a tally's legend and a group's bar alike. Its tone's own
  // colour, or, where the tone has none of its own (neutral, accent), an
  // ink seeded by its value (`ink`, `models/ink.ts`'s `inkOf`).
  let { tone = 'neutral', ink }: { tone?: Tone; ink?: number } = $props()
</script>

<span class="dot {tone}" class:inked={ink !== undefined} style={ink !== undefined ? inked(ink) : undefined} aria-hidden="true"></span>

<style>
  .dot {
    display: inline-block;
    flex: none;
    width: 0.4em;
    height: 0.4em;
    border-radius: 50%;
    vertical-align: middle;
  }
  .neutral {
    background: var(--neutral-text);
  }
  /* Quieter than the rest, as its ring is: accent is under way, never
     an alarm. */
  .accent {
    background: var(--text-muted);
  }
  .positive {
    background: var(--positive-text);
  }
  .negative {
    background: var(--negative-text);
  }
  .warning {
    background: var(--warning-text);
  }
  .failed {
    background: var(--negative-text);
  }
  /* An ink seeded by the value, last, over whatever tone it was drawn
     with: only `neutral` and `accent` carry one. */
  .inked {
    background: var(--mark);
  }
</style>
