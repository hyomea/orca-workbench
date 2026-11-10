import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { PortfolioCommand, PortfolioState, PortfolioTask } from '../../../../shared/portfolio'
import { portfolioTrackRole } from '../../../../shared/portfolio-ticket-roles'
import { confirmPortfolioPush } from './portfolio-task-review-actions'
import { usePortfolioPrLookup, usePortfolioPrRefresh } from './portfolio-track-pr'

// Team mode, on a track the user builds: once development submits, the user confirms each push,
// and the development session opens (then updates) a draft PR. Agents never push on their own.
export function PortfolioTaskPush({
  state,
  task,
  busy,
  onSave,
  onNotice
}: {
  state: PortfolioState
  task: PortfolioTask
  busy: boolean
  onSave: (command: PortfolioCommand) => Promise<boolean>
  onNotice: (notice: string) => void
}): React.JSX.Element | null {
  const attempt = task.attempts.at(-1)
  const pr = usePortfolioPrLookup()(attempt?.worktreeId ?? '')
  usePortfolioPrRefresh(attempt ? [attempt.worktreeId] : [])
  const team =
    state.projects.find((project) => project.id === task.projectId)?.reviewMode === 'team'
  if (
    !team ||
    task.stage !== 'development' ||
    (task.status !== 'review' && task.status !== 'accepted') ||
    portfolioTrackRole(state, task) !== 'author' ||
    pr?.status === 'merged' ||
    pr?.status === 'closed'
  ) {
    return null
  }
  if (attempt?.state !== 'launched') {
    return (
      <p className="text-muted-foreground">
        {translate(
          'portfolio.pushSessionClosed',
          'The development session is closed; push the branch and open the draft PR yourself.'
        )}
      </p>
    )
  }
  const opened = pr?.number !== undefined
  async function confirm(): Promise<void> {
    const notice = await confirmPortfolioPush(
      () => onSave({ kind: 'task.confirmPush', taskId: task.id }),
      task,
      pr?.number
    )
    if (notice !== false) {
      onNotice(notice)
    }
  }
  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        disabled={busy || !pr || pr.status === 'checking'}
        onClick={() => void confirm()}
      >
        {opened
          ? translate('portfolio.pushToPr', 'Push new commits to PR #{{number}}', {
              number: pr.number
            })
          : translate('portfolio.pushDraftPr', 'Push and open a draft PR')}
      </Button>
      <p className="text-xs text-muted-foreground">
        {translate(
          'portfolio.pushHint',
          'Confirms the push to the development agent. It keeps the PR a draft; you mark it ready after the local code review.'
        )}
      </p>
    </div>
  )
}
