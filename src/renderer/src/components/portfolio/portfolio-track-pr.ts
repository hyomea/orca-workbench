import { useEffect, useMemo } from 'react'
import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { getIndexedRepoMap } from '@/store/repos/repository-catalog-index'
import { findWorktreeById } from '@/store/github/refresh/worktree-refresh'
import { translate } from '@/i18n/i18n'
import { getGitHubPRCacheKey } from '../../../../shared/github/github-cache-key'
import type { PRInfo } from '../../../../shared/github/pull-request-types'
import { isGitHubPRSuppressed } from '../../../../shared/worktree/github-pr-suppression'

export type PortfolioPrStatus =
  | 'checking'
  | 'none'
  | 'ciFailing'
  | 'changesRequested'
  | 'readyToMerge'
  | 'inReview'
  | 'closed'
  | 'merged'

export type PortfolioTrackPr = {
  worktreeId: string
  status: PortfolioPrStatus
  number?: number
  url?: string
  // The PR's latest commit, to tell a reviewer when the author pushed since their review.
  headSha?: string
  // What reading the PR's comments needs.
  repo?: { path: string; id: string }
  prRepo?: PRInfo['prRepo']
}

// The PR of a track's workspace; undefined once the workspace is gone (such as removed after
// merging), when Workbench can no longer follow it.
export type PortfolioPrLookup = (worktreeId: string) => PortfolioTrackPr | undefined

export function portfolioPrStatus(pr: PRInfo | null): PortfolioPrStatus {
  if (!pr) {
    return 'none'
  }
  if (pr.state === 'merged' || pr.state === 'closed') {
    return pr.state
  }
  if (pr.checksStatus === 'failure') {
    return 'ciFailing'
  }
  if (pr.reviewDecision === 'CHANGES_REQUESTED') {
    return 'changesRequested'
  }
  return pr.state === 'open' && pr.reviewDecision === 'APPROVED' && pr.checksStatus === 'success'
    ? 'readyToMerge'
    : 'inReview'
}

// Reads the branch PR the way Orca's Checks panel does, from the shared GitHub cache; this never
// fetches. An entry that is missing has not been fetched yet; one without data means no PR.
export function portfolioWorktreePr(
  state: AppState,
  worktreeId: string
): PortfolioTrackPr | undefined {
  const worktree = findWorktreeById(state, worktreeId)
  const repo = worktree && getIndexedRepoMap(state.repos).get(worktree.repoId)
  if (!worktree || !repo) {
    return undefined
  }
  const branch = worktree.branch.replace(/^refs\/heads\//, '')
  if (!branch) {
    return { worktreeId, status: 'none' }
  }
  const entry =
    state.prCache[
      getGitHubPRCacheKey(
        repo.path,
        repo.id,
        branch,
        state.settings,
        repo.connectionId,
        repo.executionHostId,
        true
      )
    ]
  if (!entry) {
    return { worktreeId, status: 'checking' }
  }
  const pr = entry.data && !isGitHubPRSuppressed(worktree, entry.data.number) ? entry.data : null
  return {
    worktreeId,
    status: portfolioPrStatus(pr),
    ...(pr
      ? {
          number: pr.number,
          url: pr.url,
          ...(pr.headSha ? { headSha: pr.headSha } : {}),
          repo: { path: repo.path, id: repo.id },
          prRepo: pr.prRepo
        }
      : {})
  }
}

// A lookup that follows the shared GitHub cache, so cells update when any refresh lands.
export function usePortfolioPrLookup(): PortfolioPrLookup {
  const prCache = useAppStore((s) => s.prCache)
  const worktreesByRepo = useAppStore((s) => s.worktreesByRepo)
  const repos = useAppStore((s) => s.repos)
  const settings = useAppStore((s) => s.settings)
  return useMemo(() => {
    const state = useAppStore.getState()
    return (worktreeId) => portfolioWorktreePr(state, worktreeId)
    // The listed slices are everything portfolioWorktreePr reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prCache, worktreesByRepo, repos, settings])
}

// Asks Orca's GitHub refresh (with its rate limits) for the PRs a page shows, when they are stale.
export function usePortfolioPrRefresh(worktreeIds: readonly string[]): void {
  const refresh = useAppStore((s) => s.refreshGitHubForWorktreeIfStale)
  const key = [...new Set(worktreeIds)].sort().join('\n')
  useEffect(() => {
    for (const worktreeId of key ? key.split('\n') : []) {
      refresh(worktreeId)
    }
  }, [key, refresh])
}

export function prStatusLabel(status: PortfolioPrStatus): string {
  switch (status) {
    case 'checking':
      return translate('portfolio.prChecking', 'Checking PR…')
    case 'none':
      return translate('portfolio.prNone', 'Ready to open a PR')
    case 'ciFailing':
      return translate('portfolio.prCiFailing', 'CI failing')
    case 'changesRequested':
      return translate('portfolio.prChangesRequested', 'Changes requested')
    case 'readyToMerge':
      return translate('portfolio.prReadyToMerge', 'Approved; ready to merge')
    case 'inReview':
      return translate('portfolio.prInReview', 'Waiting on review or CI')
    case 'closed':
      return translate('portfolio.prClosed', 'Closed without merging')
    case 'merged':
      return translate('portfolio.prMerged', 'Merged')
  }
}
