import type { HandlerGroup } from './handler-group-manifest'

export const WORKBENCH_HANDLER_GROUP: HandlerGroup = {
  name: 'workbench',
  keys: [
    'workbench list',
    'workbench status',
    'workbench schema',
    'workbench apply',
    'workbench task start',
    'workbench task submit',
    'workbench task step',
    'workbench note propose',
    'workbench outcome propose',
    'workbench personal-notes list',
    'workbench personal-notes index'
  ],
  load: async () => (await import('./handlers/workbench.js')).WORKBENCH_HANDLERS
}
