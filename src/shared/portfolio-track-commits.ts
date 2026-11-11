import type { PortfolioState, PortfolioTask } from './portfolio'
import { portfolioTrackRole } from './portfolio-ticket-roles'

// Where a track's stages find each other, and the commits they look at.
export function portfolioTrackTask(
  state: PortfolioState,
  task: Pick<PortfolioTask, 'id' | 'workItemId' | 'platform'>,
  stage: PortfolioTask['stage']
): PortfolioTask | undefined {
  if (!task.workItemId) {
    return undefined
  }
  return state.tasks.findLast(
    (entry) =>
      entry.stage === stage &&
      entry.workItemId === task.workItemId &&
      entry.platform === task.platform
  )
}

// A submission is the entry that moved the task into review, or a resubmission of newer commits
// while in review; other entries can keep that status (such as an execution closed during
// review) without being a new submission.
export function portfolioSubmissionIndex(task: PortfolioTask): number {
  return task.history.findLastIndex(
    (entry, index) =>
      entry.status === 'review' &&
      (entry.resubmitted || task.history[index - 1]?.status !== 'review')
  )
}

export function portfolioSubmittedCommit(task: PortfolioTask): string | undefined {
  return task.history[portfolioSubmissionIndex(task)]?.commit
}

export function portfolioSubmittedAt(task: PortfolioTask): number | undefined {
  return task.history[portfolioSubmissionIndex(task)]?.at
}

// The version a code review or QA task looks at: what development submitted. QA can also take
// the commit an accepted code review recorded, since the reviewer adds no commits of its own and
// development may have been submitted before submissions recorded one.
export function portfolioStageCommit(
  state: PortfolioState,
  task: PortfolioTask
): string | undefined {
  const development = portfolioTrackTask(state, task, 'development')
  const submitted = development && portfolioSubmittedCommit(development)
  if (submitted || task.stage !== 'qa') {
    return submitted
  }
  const review = portfolioTrackTask(state, task, 'codeReview')
  return review?.status === 'accepted' ? portfolioSubmittedCommit(review) : undefined
}

// The development commit a code review or QA session was asked to look at.
export function portfolioReviewedCommit(
  state: PortfolioState,
  task: PortfolioTask
): string | undefined {
  const attempt = task.attempts.at(-1)
  if (!attempt || task.stage === 'development') {
    return undefined
  }
  if (attempt.commit) {
    return attempt.commit
  }
  // Sessions started before attempts recorded it looked at what development had submitted then.
  return portfolioTrackTask(state, task, 'development')?.history.findLast(
    (entry) => entry.status === 'review' && entry.commit && entry.at <= attempt.createdAt
  )?.commit
}

// Development submitted again after this code review or QA session was given its commit, so its
// look (and any report) covers an older version.
export function portfolioStageOutdated(
  state: PortfolioState,
  task: PortfolioTask
): { reviewed: string; current: string } | undefined {
  if (task.stage === 'development' || portfolioTrackRole(state, task) === 'reviewer') {
    return undefined
  }
  const reviewed = portfolioReviewedCommit(state, task)
  const current = portfolioStageCommit(state, task)
  return reviewed && current && reviewed !== current ? { reviewed, current } : undefined
}
