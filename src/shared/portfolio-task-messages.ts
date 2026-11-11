import type { PortfolioTask } from './portfolio'

// What a code review or QA session is told when it looks again in the same session: after it
// sent findings back, or when development resubmitted newer commits than it was given. Workbench's
// button and the outcome coordinator send the same text.
export function portfolioRunAgainMessage(
  task: PortfolioTask,
  commit: string,
  since: string | undefined
): string {
  const range = since
    ? `the commits from ${since} to ${commit}`
    : 'the commits since your last look'
  return [
    `Development submitted again (commit ${commit}) for your Workbench task ${task.id}.`,
    task.stage === 'qa'
      ? `Test this version: check ${range}, that each finding you sent back is resolved, re-run the checks they affect, and look for regressions.`
      : `Review ${range}: check that each finding you sent back is resolved, and look for new problems.`,
    'Then submit your updated report with `task submit`; an earlier report covers the older commit. Do not push, or open or comment on a PR.'
  ].join('\n')
}
