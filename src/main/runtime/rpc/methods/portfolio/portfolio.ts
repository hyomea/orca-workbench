import {
  attachPortfolioDesign,
  readPortfolioDesign,
  removePortfolioDesign
} from '../../../../portfolio/portfolio-design-store'
import { randomUUID } from 'node:crypto'
import { getAppEnvironment } from '../../../../../shared/app-environment'
import { folderWorkspaceRepoId } from '../../../../../shared/folder-workspaces/folder-workspace-worktree'
import { applyPortfolioCommand } from '../../../../../shared/portfolio'
import { applyPortfolioBatch } from '../../../../../shared/portfolio-batch'
import {
  PortfolioAttachDesign,
  PortfolioBatchParams,
  PortfolioCreateWorkbench,
  PortfolioWorkbenches,
  PortfolioExportNotes,
  PortfolioProposeNote,
  PortfolioProposeChecklist,
  PortfolioReportOutcome,
  PortfolioReadDesign,
  PortfolioRemoveDesign,
  PortfolioLaunch,
  PortfolioMutate,
  PortfolioPrepareSteward,
  PortfolioPrepareCoordinator,
  PortfolioRead,
  PortfolioIndexPersonalNotes,
  PortfolioPersonalNotes,
  PortfolioSetPersonalNotesFolder
} from '../../../../../shared/rpc-contract/portfolio-params'
import { AgentLaunchReplay } from '../../../../../shared/rpc-contract/agent-launch-params'
import type { PortfolioStore } from '../../../../portfolio/portfolio-store'
import {
  createWorkbench,
  listWorkbenches,
  workbenchStore
} from '../../../../portfolio/workbench-spaces'
import { exportPortfolioNotes } from '../../../../portfolio/portfolio-note-files'
import {
  portfolioStewardCli,
  preparePortfolioSteward
} from '../../../../portfolio/portfolio-steward'
import {
  indexPersonalNotes,
  personalNoteAppliesTo,
  personalNotesPrompt,
  readPersonalNotesFolder,
  scanPersonalNotes,
  setPersonalNotesFolder
} from '../../../../portfolio/personal-notes'
import { prepareOutcomeCoordinator } from '../../../../portfolio/portfolio-outcome-coordinator'
import {
  launchPortfolioTask,
  portfolioExecutionInFlight
} from '../../../../portfolio/portfolio-execution'
import { defineMethod } from '../../core'
import { AGENT_LAUNCH_METHODS } from '../agent-launch/agent-launch'
import { PORTFOLIO_DISCOVERY_METHODS } from './portfolio-discovery'

function userData(): string {
  return getAppEnvironment().getPath('userData')
}

// Personal notes are shared by every workbench, so their methods take none.
function store(params: { workbenchId?: string } = {}): PortfolioStore {
  return workbenchStore(userData(), params.workbenchId)
}

export const PORTFOLIO_METHODS = [
  ...PORTFOLIO_DISCOVERY_METHODS,
  defineMethod({
    name: 'portfolio.workbenches',
    permission: 'workspace',
    params: PortfolioWorkbenches,
    handler: () => listWorkbenches(userData())
  }),
  defineMethod({
    name: 'portfolio.createWorkbench',
    permission: 'workspace',
    params: PortfolioCreateWorkbench,
    handler: (params) => createWorkbench(userData(), params.name)
  }),
  defineMethod({
    name: 'portfolio.attachDesign',
    permission: 'workspace',
    params: PortfolioAttachDesign,
    handler: (params) => attachPortfolioDesign(store(params), params)
  }),
  defineMethod({
    name: 'portfolio.readDesign',
    permission: 'workspace',
    params: PortfolioReadDesign,
    handler: (params) => readPortfolioDesign(store(params), params.attachmentId)
  }),
  defineMethod({
    name: 'portfolio.removeDesign',
    permission: 'workspace',
    params: PortfolioRemoveDesign,
    handler: (params) => removePortfolioDesign(store(params), params)
  }),
  defineMethod({
    name: 'portfolio.read',
    permission: 'workspace',
    params: PortfolioRead,
    handler: (params) => store(params).read()
  }),
  defineMethod({
    name: 'portfolio.mutate',
    permission: 'workspace',
    params: PortfolioMutate,
    handler: (params) => {
      const data = store(params)
      return data.update(params.revision, (state) => {
        if ('taskId' in params.command && portfolioExecutionInFlight(data, params.command.taskId)) {
          throw new Error('Wait for the launch to settle before changing this task.')
        }
        applyPortfolioCommand(state, params.command, randomUUID(), Date.now())
      })
    }
  }),
  defineMethod({
    name: 'portfolio.prepareSteward',
    permission: 'workspace',
    params: PortfolioPrepareSteward,
    handler: (params) =>
      preparePortfolioSteward(store(params), portfolioStewardCli(getAppEnvironment().isPackaged()))
  }),
  defineMethod({
    // The user started the outcome's coordinator: its folder is written and the hand-off recorded.
    name: 'portfolio.prepareCoordinator',
    permission: 'workspace',
    params: PortfolioPrepareCoordinator,
    handler: (params) =>
      prepareOutcomeCoordinator(
        store(params),
        params.workItemId,
        portfolioStewardCli(getAppEnvironment().isPackaged())
      )
  }),
  defineMethod({
    name: 'portfolio.exportNotes',
    permission: 'workspace',
    params: PortfolioExportNotes,
    handler: (params) => exportPortfolioNotes(store(params), params.projectId, params.directory)
  }),
  defineMethod({
    name: 'portfolio.setPersonalNotesFolder',
    permission: 'workspace',
    params: PortfolioSetPersonalNotesFolder,
    handler: (params) => setPersonalNotesFolder(store(), params.folder)
  }),
  defineMethod({
    name: 'portfolio.indexPersonalNotes',
    permission: 'workspace',
    params: PortfolioIndexPersonalNotes,
    handler: () => indexPersonalNotes(store())
  }),
  defineMethod({
    // Agents read the list; notes the user closed to every agent are left out.
    name: 'portfolio.personalNotes',
    permission: 'workspace',
    params: PortfolioPersonalNotes,
    handler: async (params) => {
      const folder = await readPersonalNotesFolder(store())
      const notes = folder ? await scanPersonalNotes(folder) : []
      const repo = params.repo
      return {
        folder,
        notes: notes.filter(
          (note) =>
            note.agents !== 'none' &&
            (!repo || personalNoteAppliesTo(note, { path: repo, displayName: repo }))
        )
      }
    }
  }),
  defineMethod({
    // Agents propose; only the user's review in the Projects page changes a note.
    name: 'portfolio.proposeNote',
    permission: 'workspace',
    params: PortfolioProposeNote,
    handler: async (params) => {
      const id = randomUUID()
      await store(params).update(null, (state) => {
        applyPortfolioCommand(
          state,
          { kind: 'noteDraft.submit', draft: params.draft },
          id,
          Date.now()
        )
      })
      return { draftId: id }
    }
  }),
  defineMethod({
    // Agents propose; only the user's review in the outcome's inbox changes its checklist.
    name: 'portfolio.proposeChecklist',
    permission: 'workspace',
    params: PortfolioProposeChecklist,
    handler: async (params) => {
      const id = randomUUID()
      await store(params).update(null, (state) => {
        applyPortfolioCommand(
          state,
          {
            kind: 'workItem.proposeChecklist',
            workItemId: params.workItemId,
            proposal: params.proposal
          },
          id,
          Date.now()
        )
      })
      return { proposalId: id }
    }
  }),
  defineMethod({
    // An agent's open question goes to the outcome's inbox, for its coordinator and the user.
    name: 'portfolio.reportOutcome',
    permission: 'workspace',
    params: PortfolioReportOutcome,
    handler: async (params) => {
      const id = randomUUID()
      await store(params).update(null, (state) => {
        applyPortfolioCommand(
          state,
          { kind: 'workItem.report', workItemId: params.workItemId, report: params.report },
          id,
          Date.now()
        )
      })
      return { reportId: id }
    }
  }),
  defineMethod({
    // One revision for the whole batch: either every step applies or none does.
    name: 'portfolio.batch',
    permission: 'workspace',
    params: PortfolioBatchParams,
    handler: async (params) => {
      const data = store(params)
      let refs: Record<string, string> = {}
      const state = await data.update(params.revision ?? null, (next) => {
        refs = applyPortfolioBatch(next, params.steps, randomUUID, Date.now(), (command) => {
          if ('taskId' in command && portfolioExecutionInFlight(data, command.taskId)) {
            throw new Error('Wait for the launch to settle before changing this task.')
          }
        })
      })
      return { revision: state.revision, refs }
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
      const data = store(params)
      const personalNotes = await personalNotesPrompt(data, scope.repo ?? null)
      return launchPortfolioTask(
        data,
        { ...params, worktreeId: scope.id, repoId, personalNotes },
        (attempt) =>
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
