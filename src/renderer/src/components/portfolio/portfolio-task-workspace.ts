import type { PortfolioState, PortfolioTask } from '../../../../shared/portfolio'
import type { PortfolioWorkspace } from './PortfolioTaskDetail'

// A track's stages usually continue on the same branch: prefer where its work was last
// submitted, so a launch in the wrong workspace does not become the suggestion. Other platforms
// of the outcome build on other branches, such as a teammate's PR the user reviews.
export function portfolioDefaultWorkspace(
  state: PortfolioState,
  task: PortfolioTask,
  workspaces: readonly PortfolioWorkspace[]
): string {
  const available = new Set(workspaces.map((workspace) => workspace.id))
  const related = state.tasks.filter(
    (entry) =>
      entry.id === task.id ||
      (task.workItemId && entry.workItemId === task.workItemId && entry.platform === task.platform)
  )
  const latest = (tasks: PortfolioTask[]): string | undefined =>
    tasks
      .flatMap((entry) => entry.attempts)
      .filter((attempt) => available.has(attempt.worktreeId))
      .sort((a, b) => b.createdAt - a.createdAt)[0]?.worktreeId
  const submitted = related.filter((entry) =>
    entry.history.some((event) => event.status === 'review')
  )
  return latest(submitted) ?? latest(related) ?? workspaces[0]?.id ?? ''
}
