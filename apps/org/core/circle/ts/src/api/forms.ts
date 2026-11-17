import type { Form } from '@cella/org-db'
import type { Icon } from '../models/circle.ts'

// What the shell's forms send, read into the handlers' inputs.

// A picker's own icon, or none: its "none" choice sends an empty string.
export const icon = (form: Form, circle: string): Icon => ({ circle, icon: form.get('icon') || null })
