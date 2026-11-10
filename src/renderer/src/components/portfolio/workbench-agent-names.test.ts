import { expect, it } from 'vitest'
import {
  applyPortfolioCommand,
  emptyPortfolio,
  PortfolioCommand,
  type PortfolioState
} from '../../../../shared/portfolio'
import { workbenchAgentNames } from './workbench-agent-names'

function apply(state: PortfolioState, command: unknown, id: string): void {
  applyPortfolioCommand(state, PortfolioCommand.parse(command), id, 1)
}

function run(state: PortfolioState, taskId: string, paneKey: string, handle?: string): void {
  state.tasks
    .find((task) => task.id === taskId)!
    .attempts.push({
      operationId: `${taskId}:${paneKey}`,
      worktreeId: 'wt',
      agent: 'claude',
      createdAt: 1,
      state: 'launched',
      prompt: 'Work',
      paneKey,
      ...(handle ? { handle } : {})
    })
}

it('names each Workbench session for its agent and stage, numbering repeated runs', () => {
  const state = emptyPortfolio()
  apply(
    state,
    { kind: 'project.create', project: { name: 'Apps', objective: 'Ship', repoIds: ['r'] } },
    'project'
  )
  apply(
    state,
    {
      kind: 'role.create',
      role: {
        name: 'Android Engineer',
        agentName: 'Kiki',
        agent: 'claude',
        responsibility: 'Build'
      }
    },
    'engineer'
  )
  apply(
    state,
    { kind: 'role.create', role: { name: 'Reviewer', agent: 'claude', responsibility: 'Review' } },
    'reviewer'
  )
  apply(
    state,
    {
      kind: 'workItem.create',
      workItem: {
        projectId: 'project',
        kind: 'improvement',
        title: 'Signature upload',
        description: 'Upload through the API',
        acceptanceCriteria: 'Works',
        designReferences: '',
        tickets: [{ platform: 'android', reference: 'ENG-2' }],
        parity: false
      }
    },
    'outcome'
  )
  for (const [id, stage, roleId] of [
    ['development', 'development', 'engineer'],
    ['codeReview', 'codeReview', 'reviewer']
  ] as const) {
    apply(
      state,
      {
        kind: 'task.create',
        task: {
          projectId: 'project',
          workItemId: 'outcome',
          platform: 'android',
          roleId,
          stage,
          title: id,
          instructions: 'Work',
          acceptanceCriteria: 'Done'
        }
      },
      id
    )
  }
  run(state, 'development', 'tab-1:1', 'term-1')
  run(state, 'codeReview', 'tab-2:1')
  run(state, 'codeReview', 'tab-3:1')

  expect(workbenchAgentNames(state)).toEqual({
    'pane:tab-1:1': 'Kiki · Development',
    'handle:term-1': 'Kiki · Development',
    // Without an agent name the role names the session.
    'pane:tab-2:1': 'Reviewer · Code review · run 1',
    'pane:tab-3:1': 'Reviewer · Code review · run 2'
  })
})
