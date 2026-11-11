import { translate } from '@/i18n/i18n'
import {
  applyPortfolioCommand,
  type PortfolioCommand,
  type PortfolioState,
  type PortfolioTask
} from '../../../../shared/portfolio'
import {
  portfolioChecklist,
  portfolioChecklistChanges,
  portfolioChecklistText
} from '../../../../shared/portfolio-checklist'
import { portfolioOpenExecution } from '../../../../shared/portfolio-task-stages'
import { relayToPortfolioTask } from './portfolio-task-review-actions'

function agentName(state: PortfolioState, task: PortfolioTask): string {
  const role = state.roles.find((entry) => entry.id === task.roleId)
  return `${role?.agentName ?? role?.name ?? task.title} (${task.title})`
}

// Saves a checklist change, then tells every open session on the outcome what changed, since a
// running session keeps the prompt it started with. Resolves to false when the save failed, else
// the notice to show.
export async function saveChecklistChange(
  state: PortfolioState,
  workItemId: string,
  command: PortfolioCommand,
  save: (command: PortfolioCommand) => Promise<boolean>
): Promise<string | false> {
  const before = state.workItems.find((entry) => entry.id === workItemId)
  // The same command on a copy gives the checklist the save will store. When it is refused,
  // the save reports why.
  const preview = structuredClone(state)
  let after: PortfolioState['workItems'][number] | undefined
  try {
    applyPortfolioCommand(preview, command, 'preview', Date.now())
    after = preview.workItems.find((entry) => entry.id === workItemId)
  } catch {
    after = undefined
  }
  if (!(await save(command))) {
    return false
  }
  const changes =
    before && after
      ? portfolioChecklistChanges(portfolioChecklist(before), portfolioChecklist(after))
      : []
  const open = state.tasks.filter(
    (task) => task.workItemId === workItemId && portfolioOpenExecution(task)
  )
  if (!after || !changes.length || !open.length) {
    return ''
  }
  const notices: string[] = []
  const sent: string[] = []
  for (const task of open) {
    const notice = await relayToPortfolioTask(
      task,
      [
        `The user updated the checklist of outcome "${after.title}" (Workbench outcome ${after.id}), which your Workbench task ${task.id} belongs to:`,
        ...changes.map((line) => `- ${line}`),
        '',
        `The checklist now reads:\n${portfolioChecklistText(after)}`,
        '',
        'Follow it from here on. If work already done conflicts with it, tell the user instead of changing it silently.'
      ].join('\n')
    )
    if (notice) {
      notices.push(`${agentName(state, task)}: ${notice}`)
    } else {
      sent.push(agentName(state, task))
    }
  }
  return [
    ...(sent.length
      ? [
          translate('portfolio.checklistSent', 'Sent the change to {{names}}.', {
            names: sent.join(', ')
          })
        ]
      : []),
    ...notices
  ].join('\n')
}
