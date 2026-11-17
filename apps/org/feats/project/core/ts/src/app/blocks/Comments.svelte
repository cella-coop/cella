<script lang="ts">
  import { Threads } from '@cella/org-body/app'
  import type { Named } from '@cella/org-body/models'
  import type { Threaded } from '../../models/comment.ts'

  // The project's threads under its Activity, in core body's `Threads`, with
  // the box that posts a comment and its mention picker, through the
  // project's `post` and `resolve` writes, and each comment's reactions,
  // toggled through `react`, where its circle has them on; one who may
  // not discuss the project reads them and has no box. `readers` is
  // handed down by the shell, fetched in the browser once the box mounts.
  let { data, readers }: { data: Threaded; id: string; readers?: () => Promise<unknown[]> } = $props()
</script>

<Threads
  comments={data.comments}
  readers={readers as (() => Promise<Named[]>) | undefined}
  discuss={data.discuss}
  post="post"
  resolve="resolve"
  react="react"
  reactions={data.reactions}
/>
