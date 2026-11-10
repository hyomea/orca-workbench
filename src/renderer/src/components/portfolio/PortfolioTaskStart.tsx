import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { PortfolioCommand, PortfolioState, PortfolioTask } from '../../../../shared/portfolio'
import {
  portfolioStageBlocker,
  portfolioStageCommit
} from '../../../../shared/portfolio-task-stages'
import { PortfolioSelect } from './portfolio-controls'
import { PortfolioEndExecution } from './PortfolioEndExecution'
import { runPortfolioTaskAgain } from './portfolio-task-review-actions'
import { portfolioDefaultWorkspace } from './portfolio-task-workspace'
import type { PortfolioWorkspace } from './PortfolioTaskDetail'

// How a planned task's agent starts: a new session in a chosen workspace, or, for code review
// or QA whose findings went back to development, the same session looking at the next version.
export function PortfolioTaskStart({
  state,
  task,
  workspaces,
  busy,
  onLaunch,
  onSave,
  onNotice
}: {
  state: PortfolioState
  task: PortfolioTask
  workspaces: readonly PortfolioWorkspace[]
  busy: boolean
  onLaunch: (taskId: string, worktreeId: string) => Promise<boolean>
  onSave: (command: PortfolioCommand) => Promise<boolean>
  onNotice: (notice: string) => void
}): React.JSX.Element | null {
  const [workspaceId, setWorkspaceId] = useState(() =>
    portfolioDefaultWorkspace(state, task, workspaces)
  )
  const attempt = task.attempts.at(-1)
  async function runAgain(): Promise<void> {
    const commit = portfolioStageCommit(state, task)
    if (!commit) {
      return
    }
    const notice = await runPortfolioTaskAgain(
      () => onSave({ kind: 'task.runAgain', taskId: task.id }),
      task,
      commit
    )
    if (notice !== false) {
      onNotice(notice)
    }
  }
  if (task.status !== 'todo') {
    return null
  }
  const blocker = portfolioStageBlocker(state, task)
  if (attempt && attempt.state !== 'closed') {
    return attempt.state === 'launched' && task.stage !== 'development' ? (
      <div className="space-y-2">
        {blocker && <p className="text-muted-foreground">{blocker}</p>}
        <Button disabled={busy || Boolean(blocker)} onClick={() => void runAgain()}>
          {task.stage === 'qa'
            ? translate('portfolio.testAgain', 'Test again in this session')
            : translate('portfolio.reviewAgain', 'Review again in this session')}
        </Button>
        <p className="text-xs text-muted-foreground">
          {translate(
            'portfolio.runAgainHint',
            'The same agent checks the new version against what it sent back. End its session to start a fresh one instead.'
          )}
        </p>
        <PortfolioEndExecution taskId={task.id} busy={busy} onSave={onSave} />
      </div>
    ) : null
  }
  return (
    <div className="space-y-2">
      <PortfolioSelect
        label={translate('portfolio.workspace', 'Execution workspace')}
        value={workspaceId}
        onChange={setWorkspaceId}
        options={workspaces}
        disabled={busy}
      />
      {!workspaces.length && (
        <p className="text-muted-foreground">
          {translate(
            'portfolio.noWorkspace',
            'Open a local workspace from a linked repository or folder first.'
          )}
        </p>
      )}
      {blocker && <p className="text-muted-foreground">{blocker}</p>}
      <Button
        disabled={busy || !workspaceId || Boolean(blocker)}
        onClick={() => void onLaunch(task.id, workspaceId)}
      >
        {busy
          ? translate('portfolio.launching', 'Starting agent…')
          : translate('portfolio.startAgent', 'Start agent')}
      </Button>
    </div>
  )
}
