<script lang="ts">
  import { Button, Form, Grid, Note, date } from '@cella/org-ui'
  import { cell, hours, type Week } from '../../models/week.ts'
  import { useWeek } from '../../hooks/useWeek.ts'

  // The acting worker's week of time, a project to a row and a day to a
  // column, the co-op's own time last: what is logged shows in each cell,
  // and what is typed into one is added to it, each its own write when the
  // week is logged; a refusal stops the rest, and the cells written
  // before it are emptied. A day to come, or outside their employment, takes
  // nothing. This week or the one before.
  let { about }: { rows: unknown[]; about: { weeks?: Week[] } } = $props()

  const state = useWeek(() => about.weeks ?? [])
  const w = $derived(state.week)
  const weekday = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })
</script>

{#if w}
  <Form action="week" submit="Log the week">
    {#each w.rows as r (r.project)}<input type="hidden" name="row" value={r.project || '_'} />{/each}
    {#each w.days as d (d.day)}<input type="hidden" name="day" value={d.day} />{/each}
    <Grid
      caption="Hours of the week of {date(w.monday)}"
      columns={w.days.map((d) => ({ key: d.day, label: weekday(d.day), sub: d.day.slice(8), open: d.open }))}
      rows={w.rows.map((r) => ({ key: r.project, label: r.title }))}
      name={(row, day) => cell(row, day)}
      held={(row, day) => hours(w.logged[row]?.[day] ?? 0)}
    >
      {#snippet corner()}
        Week of {date(w.monday)}
        {#if (about.weeks ?? []).length > 1}
          <Button onclick={() => state.show(state.shown ? 0 : 1)}>{state.shown ? 'This week' : 'The week before'}</Button>
        {/if}
      {/snippet}
    </Grid>
  </Form>
  <Note text="Type the hours to add to a day and press Enter; the arrows move between days. Time on a project is billable." />
{:else}
  <Note text="Time is logged by employment, and the co-op does not employ you." />
{/if}
