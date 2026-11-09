<script lang="ts">
  import { Threads } from '@cella/org-body/app'
  import type { Page } from '../../models/task.ts'

  // The task's threads under its Activity, in core body's `Threads`, with
  // the box that posts a comment and its mention picker, through the
  // task's `post` and `resolve` writes, and each comment's reactions,
  // toggled through `react`, where the task's circle has them on; one who
  // may not discuss the task reads them and has no box.
  let { data }: { data: Page; id: string } = $props()
</script>

<Threads comments={data.comments} readers={data.readers} discuss={data.discuss} post="post" resolve="resolve" react="react" reactions={data.reactions} />
