<script lang="ts">
  import { Prose } from '@cella/org-ui'
  import type { Detail } from '../../models/motion.ts'

  // What is proposed, in its proposer's words: the body of the page and
  // nothing else. What the motion decides, its deadline and its vote are
  // the Vote widget's, placed after it.
  let { data }: { data: Detail; id: string } = $props()
</script>

<Prose text={data.body.trim() || 'No proposal text.'} />
