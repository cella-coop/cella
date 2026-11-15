<script lang="ts">
  import { Section, Settings } from '@cella/org-ui'
  import type { Contact } from '../../models/contact.ts'

  // The contact's note, a field of its own, saved as its reader leaves
  // it, with no Save button: the last writer wins it.
  let { data }: { data: Contact; id: string } = $props()
</script>

<Section title="Note">
  <Settings settings={[{ name: 'note', label: 'Note', value: data.note, rows: 4, write: 'note' }]} />
</Section>
