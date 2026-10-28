<script lang="ts">
  import { Form } from '@cella/org-ui'
  import type { Period } from '../../models/account.ts'
  import type { OpenPeriod } from '../../models/period.ts'

  // Opening the month after the latest, so entries dated in it post; the
  // months follow one another with no gap, and opening one twice changes
  // nothing. It needs close-period, which finance holds.
  let { about }: { rows: Period[]; about: OpenPeriod } = $props()
</script>

<Form action="open" submit="Open {about.month}">
  <input type="hidden" name="month" value={about.month} />
</Form>
