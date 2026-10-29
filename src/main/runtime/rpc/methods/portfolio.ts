import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { getAppEnvironment } from '../../../../shared/app-environment'
import { folderWorkspaceRepoId } from '../../../../shared/folder-workspace-worktree'
import { applyPortfolioCommand } from '../../../../shared/portfolio'
import {
  PortfolioLaunch,
  PortfolioMutate,
  PortfolioRead
} from '../../../../shared/rpc-contract/portfolio-params'
import { AgentLaunchReplay } from '../../../../shared/rpc-contract/agent-launch-params'
import { PortfolioStore } from '../../../portfolio/portfolio-store'
import {
  launchPortfolioTask,
  portfolioExecutionInFlight
} from '../../../portfolio/portfolio-execution'
import { defineMethod } from '../core'
import { AGENT_LAUNCH_METHODS } from './agent-launch'

function store(): PortfolioStore {
  return new PortfolioStore(
    join(getAppEnvironment().getPath('userData'), 'workbench', 'portfolio.json')
  )
}

export const PORTFOLIO_METHODS = [
  defineMethod({
    name: 'portfolio.read',
    permission: 'workspace',
    params: PortfolioRead,
    handler: () => store().read()
  }),
  defineMethod({
    name: 'portfolio.mutate',
    permission: 'workspace',
    params: PortfolioMutate,
    handler: (params) => {
      const data = store()
      return data.update(params.revision, (state) => {
        if ('taskId' in params.command && portfolioExecutionInFlight(data, params.command.taskId)) {
          throw new Error('Wait for the launch to settle before changing this task.')
        }
        applyPortfolioCommand(state, params.command, randomUUID(), Date.now())
      })
    }
  }),
  defineMethod({
    name: 'portfolio.launch',
    permission: 'workspace',
    requires: ['accounts'],
    params: PortfolioLaunch,
    handler: async (params, context) => {
      const scope = await context.runtime.showTerminalWorkspaceLaunchScope(
        `id:${params.worktreeId}`
      )
      const owner = scope.repo ?? scope.folderWorkspace
      const repoId =
        scope.repo?.id ??
        (scope.folderWorkspace ? folderWorkspaceRepoId(scope.folderWorkspace.projectGroupId) : null)
      if (
        !owner ||
        !repoId ||
        scope.connectionId ||
        (owner.executionHostId && owner.executionHostId !== 'local')
      ) {
        throw new Error(
          'Project task execution currently requires a workspace hosted on this computer.'
        )
      }
      const replay = AGENT_LAUNCH_METHODS.find((method) => method.name === 'agent.launchReplay')
      if (!replay) {
        throw new Error('Replay-safe agent launch is unavailable.')
      }
      return launchPortfolioTask(store(), { ...params, worktreeId: scope.id, repoId }, (attempt) =>
        replay.handler(
          AgentLaunchReplay.parse({
            agent: attempt.agent,
            operationId: attempt.operationId,
            target: { kind: 'existing', worktree: `id:${attempt.worktreeId}` },
            prompt: { text: attempt.prompt, delivery: 'submit' },
            presentation: 'background'
          }),
          context
        )
      )
    }
  })
]
