<script lang="ts">
  import { Blocks, type Embeds } from '@cella/org-ui'
  import type { Canon } from '../models/canonical.ts'
  import ReadList from './ReadList.svelte'

  // A document read, not edited: a version from its canonical form, or a
  // draft before the editor takes it over in the browser.
  let { canon, label, embeds = {}, readonly = true }: { canon: Canon; label: string; embeds?: Embeds; readonly?: boolean } = $props()
</script>

<Blocks {readonly} role="document" aria-label={label}>
  <ReadList blocks={canon.blocks} {embeds} />
</Blocks>
