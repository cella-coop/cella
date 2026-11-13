<script lang="ts">
  import { Button, useShell } from '@cella/org-ui'
  import type { Detail } from '../../models/circle.ts'

  // Lenses the co-op on this circle, which every collection then reads
  // through, or clears the lens where it is already this circle's.
  let { data }: { data: Detail; id: string } = $props()
  const shell = useShell()
  const on = $derived(shell.lens?.id === data.id)
</script>

<form method="post" action="/lens">
  <input type="hidden" name="back" value="/" />
  <input type="hidden" name="lens" value={on ? '' : data.id} />
  <Button type="submit">{on ? 'Stop viewing as this circle' : 'View as this circle'}</Button>
</form>
