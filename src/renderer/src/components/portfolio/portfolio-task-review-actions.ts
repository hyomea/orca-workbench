import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { selectWorktreeDiffCommentsOrEmpty } from '@/store/worktree-diff-comments-selector'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { translate } from '@/i18n/i18n'

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
