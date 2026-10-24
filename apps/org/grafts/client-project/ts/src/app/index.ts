import type { App } from '@cella/org-ui'
import type { Commissioned, For } from '../models/commission.ts'
import Client from './blocks/Client.svelte'
import Projects from './blocks/Projects.svelte'

// The graft's client side: whom a project is for and the form that links
// it, and the projects a client commissioned.
export const app: App = {
  name: 'client-project',
  extends: {
    projects: {
      columns: [{ key: 'client', label: 'Client', role: 'sub', value: (r: { client?: string }) => r.client }],
      page: {
        properties: (f: For) => [{ label: 'Client', value: f.client?.name ?? 'own', href: f.client ? `/clients/${f.client.id}` : undefined }],
        related: (f: For) => (f.client ? [{ label: f.client.name, sub: 'client', href: `/clients/${f.client.id}` }] : []),
        blocks: [Client],
      },
    },
    clients: {
      page: {
        properties: (ps: Commissioned[]) => [{ label: 'Projects', value: ps.length, kind: 'number' }],
        blocks: [Projects],
      },
    },
  },
}
