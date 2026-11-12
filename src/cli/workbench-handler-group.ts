import type { HandlerGroup } from './handler-group-manifest'

export const WORKBENCH_HANDLER_GROUP: HandlerGroup = {
  name: 'workbench',
  keys: [
    'workbench list',
    'workbench create',
    'workbench status',
    'workbench schema',
    'workbench apply',
    'workbench task start',
    'workbench task submit',
    'workbench task step',
    'workbench task pushed',
    'workbench task message',
    'workbench task again',
    'workbench note propose',
    'workbench outcome propose',
    'workbench outcome report',
    'workbench personal-notes list',
    'workbench personal-notes index'
  ],
  load: async () => (await import('./handlers/workbench.js')).WORKBENCH_HANDLERS
}
