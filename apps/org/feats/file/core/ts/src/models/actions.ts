import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // a new file is a fact, the uploader's own; two uploads commute
  'file:file:upload': confluent({ power: 'upload-file' }),
  // each save carries the whole merged snapshot, so the later receipt holds every edit before it
  'file:body:save': confluent({ power: 'discuss' }),
} satisfies Actions
