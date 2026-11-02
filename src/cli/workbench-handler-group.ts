import type { HandlerGroup } from './handler-group-manifest'

export const WORKBENCH_HANDLER_GROUP: HandlerGroup = {
  name: 'workbench',
  keys: [
    'workbench status',
    'workbench schema',
    'workbench apply',
    'workbench task start',
    'workbench note propose'
  ],
  load: async () => (await import('./handlers/workbench.js')).WORKBENCH_HANDLERS
}
