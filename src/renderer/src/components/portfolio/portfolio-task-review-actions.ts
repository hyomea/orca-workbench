import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { selectWorktreeDiffCommentsOrEmpty } from '@/store/slices/diff-comments/worktree-diff-comments-selector'
import { selectWorktreesByRepo } from '@/store/workspaces/catalog/workspace-record-fields'
import { translate } from '@/i18n/i18n'
import { sendMessageToAgent } from '@/lib/agent-session/messaging/agent-message-send'
import { activeAgentNotesSendFailureMessage } from '@/lib/agent-session/messaging/terminal/active-agent-note-send-result'
import type { PortfolioTask } from '../../../../shared/portfolio'
import { portfolioOpenExecution } from '../../../../shared/portfolio-task-stages'
import { parsePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'

// The combined diff snapshots git state when it opens, so wait for the workspace's first status read.
const GIT_STATE_WAIT_MS = 8000

function gitStateLoaded(state: AppState, worktreeId: string): boolean {
  const branch = state.gitBranchCompareSummaryByWorktree[worktreeId]
  // null means the workspace has no branch comparison to wait for.
  return (
    state.gitStatusByWorktree[worktreeId] !== undefined &&
    branch !== undefined &&
    branch?.status !== 'loading'
  )
}

// Opens the task's workspace on its combined diff, where line comments go back to the agent.
export async function openPortfolioTaskChanges(worktreeId: string): Promise<void> {
  const store = useAppStore.getState()
  const worktree = Object.values(selectWorktreesByRepo(store))
    .flat()
    .find((entry) => entry.id === worktreeId)
  if (!worktree || !store.setActiveWorktree(worktreeId, 'local')) {
    throw new Error(
      translate('portfolio.changesUnavailable', 'This task’s workspace is not available.')
    )
  }
  store.setActiveView('terminal')
  store.setRightSidebarOpen(true)
  store.setRightSidebarTab('source-control')
  if (!gitStateLoaded(useAppStore.getState(), worktreeId)) {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(finish, GIT_STATE_WAIT_MS)
      const unsubscribe = useAppStore.subscribe((state) => {
        if (gitStateLoaded(state, worktreeId)) {
          finish()
        }
      })
      function finish(): void {
        clearTimeout(timer)
        unsubscribe()
        resolve()
      }
    })
  }
  useAppStore.getState().openAllDiffs(worktreeId, worktree.path)
}

export type PortfolioTaskReviewComments = { total: number; unsent: number }

export function usePortfolioTaskReviewComments(
  worktreeId: string | undefined
): PortfolioTaskReviewComments {
  const comments = useAppStore((state: AppState) =>
    selectWorktreeDiffCommentsOrEmpty(state, worktreeId)
  )
  return {
    total: comments.length,
    unsent: comments.filter((comment) => !comment.sentAt).length
  }
}

// Saves findings the user returned to development; a development session that is still open
// also gets them in its own pane. Resolves to false when the save failed, else the notice to show.
export function returnPortfolioFindingsToDevelopment(
  save: () => Promise<boolean>,
  development: PortfolioTask | undefined,
  source: 'codeReview' | 'qa',
  findings: string,
  sourceTaskId: string
): Promise<string | false> {
  return saveAndRelay(
    save,
    development,
    [
      `The user sent back findings from ${source === 'qa' ? 'QA' : 'code review'} (Workbench task ${sourceTaskId}) for your task ${development?.id}.`,
      'Address them in new commits on this branch and mark affected steps, then tell the user it is ready to submit again.',
      '',
      findings
    ].join('\n')
  )
}

// Team mode: the code review or QA agent triages new PR comments or external QA feedback; on a
// teammate's PR the user reviews, the reviewer looks at the author's new commits.
export function requestPortfolioTriage(
  save: () => Promise<boolean>,
  task: PortfolioTask,
  feedback: string,
  reviewer = false
): Promise<string | false> {
  return saveAndRelay(
    save,
    task,
    [
      ...(reviewer
        ? [
            `The user asks for another review round for your Workbench task ${task.id}.`,
            'Draft comments for what changed, then submit your updated report with `task submit`. Do not push, or post or resolve anything on the PR.'
          ]
        : [
            `The user asks you to triage new ${task.stage === 'qa' ? 'external QA feedback' : 'PR review comments'} for your Workbench task ${task.id}.`,
            'Give each item a verdict (must fix, not needed with the reason, or needs discussion), then submit your updated report with `task submit`. Do not post, resolve, or edit the feedback itself.'
          ]),
      '',
      feedback
    ].join('\n')
  )
}

// The message is stored either way; when it cannot reach the pane, the notice says so, and a
// closed session receives it in its next launch prompt.
async function saveAndRelay(
  save: () => Promise<boolean>,
  target: PortfolioTask | undefined,
  prompt: string
): Promise<string | false> {
  if (!(await save())) {
    return false
  }
  if (!target || !portfolioOpenExecution(target)) {
    return ''
  }
  const attempt = target.attempts.at(-1)
  const pane = attempt?.paneKey ? parsePaneKey(attempt.paneKey) : null
  if (!attempt || !pane) {
    return translate(
      'portfolio.relayNoPaneAgent',
      'Saved, but the agent’s terminal is unknown. Paste the message into its session.'
    )
  }
  const result = await sendMessageToAgent({
    worktreeId: attempt.worktreeId,
    target: { kind: 'terminal', tabId: pane.tabId, leafId: pane.leafId },
    prompt
  })
  if (result.status === 'sent' || result.status === 'unconfirmed') {
    return ''
  }
  return translate(
    'portfolio.relayFailedAgent',
    'Saved, but it could not be sent to the agent: {{reason}} Paste the message into its session.',
    {
      reason: activeAgentNotesSendFailureMessage(result.status, {
        explicitTarget: true,
        code: result.code
      })
    }
  )
}
