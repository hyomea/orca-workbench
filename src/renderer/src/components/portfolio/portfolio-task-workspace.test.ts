import { expect, it } from 'vitest'
import type { PortfolioState, PortfolioTask } from '../../../../shared/portfolio'
import { portfolioDefaultWorkspace } from './portfolio-task-workspace'

const workspaces = [
  { id: 'ios-main', repoId: 'ios', name: 'ios-box-office' },
  { id: 'android-branch', repoId: 'android', name: 'ENG-5952' }
]

function task(
  id: string,
  workItemId: string | undefined,
  worktrees: string[],
  submitted = false
): PortfolioTask {
  return {
    id,
    projectId: 'p',
    roleId: 'r',
    title: id,
    instructions: '',
    acceptanceCriteria: '',
    status: 'todo',
    evidence: '',
    stage: 'development',
    steps: [],
    history: submitted ? [{ id: 'e', at: 1, status: 'review' as const, note: '' }] : [],
    ...(workItemId ? { workItemId } : {}),
    attempts: worktrees.map((worktreeId, index) => ({
      operationId: `${id}-${index}`,
      worktreeId,
      agent: 'claude',
      prompt: '',
      createdAt: index + (id === 'other' ? 100 : 1),
      state: 'closed' as const
    }))
  }
}

function state(tasks: PortfolioTask[]): PortfolioState {
  return { tasks } as unknown as PortfolioState
}

it('starts where the outcome last ran', () => {
  const next = task('t2', 'outcome', [])
  const earlier = task('t1', 'outcome', ['android-branch'])
  expect(portfolioDefaultWorkspace(state([earlier, next]), next, workspaces)).toBe('android-branch')
})

it('ignores other outcomes and workspaces that no longer exist', () => {
  const next = task('t2', 'outcome', [])
  const gone = task('t1', 'outcome', ['removed'])
  const other = task('other', 'elsewhere', ['android-branch'])
  expect(portfolioDefaultWorkspace(state([gone, other, next]), next, workspaces)).toBe('ios-main')
})

it('reuses the task’s own last workspace after an execution ends', () => {
  const retry = task('t2', undefined, ['android-branch'])
  expect(portfolioDefaultWorkspace(state([retry]), retry, workspaces)).toBe('android-branch')
})

it('prefers where the outcome’s work was submitted over a later launch elsewhere', () => {
  const wrong = task('t2', 'outcome', ['ios-main'])
  const done = task('t1', 'outcome', ['android-branch'], true)
  expect(portfolioDefaultWorkspace(state([done, wrong]), wrong, workspaces)).toBe('android-branch')
})
