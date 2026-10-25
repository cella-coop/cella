import type { Form } from '@cella/org-db'
import type { Class, Store } from '../models/file.ts'

// The file a form uploads, of a class and about a subject; refused when
// the form carries none.
export function store(form: Form, name: string, cls: Class, subject: string | null): Store {
  const file = form.file(name)
  if (!file) {
    throw new Error('choose a file to upload')
  }
  return { class: cls, subject, name: file.name, type: file.type.toLowerCase(), bytes: file.bytes }
}
