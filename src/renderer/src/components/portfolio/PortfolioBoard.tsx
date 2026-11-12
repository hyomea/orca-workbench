import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { PortfolioCommand, PortfolioState } from '../../../../shared/portfolio'
import {
  PORTFOLIO_OUTCOME_COORDINATOR,
  portfolioRoleLabelById
} from '../../../../shared/portfolio-roles'
import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'
import { PortfolioComposer, type PortfolioComposerKind } from './PortfolioComposer'
import { PortfolioTaskDetail, type PortfolioWorkspace } from './PortfolioTaskDetail'
import { PortfolioWelcome } from './PortfolioWelcome'
import { useRememberedInitiative } from './use-remembered-initiative'
import { PortfolioFeatures } from './PortfolioFeatures'
import { PortfolioNotes, type PortfolioNotesExport } from './PortfolioNotes'
import { PortfolioProjectBoard } from './PortfolioProjectBoard'
import { PortfolioProjectSetup } from './PortfolioProjectSetup'
import { PortfolioWorkbenchMenu } from './PortfolioWorkbenchMenu'
import {
  PortfolioAgents,
  PortfolioInitiativeContext,
  PortfolioPanel
} from './PortfolioInitiativePanels'
import { portfolioTaskObservation } from './portfolio-task-lanes'
import { usePortfolioTaskReviewComments } from './portfolio-task-review-actions'
import type { PortfolioSetupActions } from './portfolio-project-setup-types'

export function PortfolioBoard({
  state,
  repos,
  workspaces,
  activity,
  busy,
  error,
  onRefresh,
  onSave,
  onLaunch,
  onOpenWorkspace,
  onReviewChanges,
  onExportNotes,
  onOpenSteward,
  onOpenTasks,
  onOpenPersonalNotes,
  onChoosePersonalNotesFolder,
  setupActions,
  draftScope
}: {
  state: PortfolioState
  repos: readonly { id: string; name: string }[]
  workspaces: readonly PortfolioWorkspace[]
  activity: Readonly<Record<string, AgentStatusEntry>>
  busy: boolean
  error: string
  onRefresh: () => void
  onSave: (command: PortfolioCommand) => Promise<boolean>
  onLaunch: (taskId: string, worktreeId: string) => Promise<boolean>
  onOpenWorkspace: (id: string) => void
  onReviewChanges: (worktreeId: string) => void
  onExportNotes: PortfolioNotesExport
  // A prompt is the user's own question for the steward, sent from a button they pressed.
  onOpenSteward: (prompt?: string) => void
  onOpenTasks: (projectId: string) => void
  onOpenPersonalNotes: () => void
  onChoosePersonalNotesFolder: () => void
  setupActions: PortfolioSetupActions
  draftScope: string
}): React.JSX.Element {
  useTranslation()
  const [selectedProjectId, selectProject] = useRememberedInitiative()
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [taskWorkItemId, setTaskWorkItemId] = useState('')
  const [composer, setComposer] = useState<PortfolioComposerKind | null>(null)
  const [editingRoleId, setEditingRoleId] = useState('')
  const [outcomeId, setOutcomeId] = useState('')
  // A note proposal opened from an outcome's inbox.
  const [noteDraftId, setNoteDraftId] = useState('')
  const [panel, setPanel] = useState<'context' | 'agents' | 'features' | null>(null)
  const editingRole =
    composer === 'role.edit' ? state.roles.find((role) => role.id === editingRoleId) : undefined
  const project =
    state.projects.find((entry) => entry.id === selectedProjectId) ?? state.projects[0]
  const tasks = state.tasks.filter((task) => task.projectId === project?.id)
  const selectedTask = tasks.find((task) => task.id === selectedTaskId)
  const projectWorkspaces = workspaces.filter((workspace) =>
    project?.repoIds.includes(workspace.repoId)
  )
  const observation = selectedTask ? portfolioTaskObservation(selectedTask, activity) : undefined
  const reviewComments = usePortfolioTaskReviewComments(selectedTask?.attempts.at(-1)?.worktreeId)
  // The workbench's coordinator and menu sit on the initiative's title line.
  const actions = (
    <>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => onOpenSteward()}>
        <Bot aria-hidden="true" />
        {state.stewardName
          ? translate('portfolio.openStewardNamed', '{{name}} · Coordinator', {
              name: state.stewardName
            })
          : translate('portfolio.openSteward', 'Steward')}
      </Button>
      <PortfolioWorkbenchMenu
        disabled={busy}
        onRefresh={onRefresh}
        onRename={() => setComposer('organization')}
        stewardAgent={state.stewardAgent ?? 'claude'}
        onStewardAgentChange={(agent) => void onSave({ kind: 'steward.agent', agent })}
        onOpenNotes={onOpenPersonalNotes}
        onChooseNotesFolder={onChoosePersonalNotesFolder}
      />
    </>
  )

  return (
    <div
      data-slot="portfolio-page"
      className="@container/portfolio h-full min-h-0 overflow-y-auto bg-background text-foreground scrollbar-sleek"
    >
      {!project && <header className="flex justify-end gap-2 px-5 pt-4">{actions}</header>}
      {error && (
        <p role="alert" className="border-b border-border px-5 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {project ? (
        <div>
          <PortfolioProjectBoard
            key={project.id}
            project={project}
            projects={state.projects}
            actions={actions}
            hideHeader={!!outcomeId}
            onSelectProject={(id) => {
              selectProject(id)
              setOutcomeId('')
            }}
            onCreateProject={() => setComposer('project')}
            roleCount={state.roles.length}
            onEditProject={() => setComposer('project.edit')}
            onOpenContext={() => setPanel('context')}
            noteProposals={
              state.noteDrafts.filter((draft) => draft.projectId === project.id).length
            }
            onOpenAgents={() => setPanel('agents')}
            onOpenFeatures={() => setPanel('features')}
            onReviewModeChange={(mode) =>
              void onSave({ kind: 'project.reviewMode', projectId: project.id, mode })
            }
          >
            <PortfolioFeatures
              view="outcomes"
              key={`outcomes:${project.id}`}
              state={state}
              projectId={project.id}
              draftScope={draftScope}
              busy={busy}
              error={error}
              onSave={onSave}
              onCreateTask={(id) => {
                setTaskWorkItemId(id)
                setComposer('task')
              }}
              onSelectTask={setSelectedTaskId}
              onCreateRole={() => setComposer('role')}
              onOpenTasks={() => onOpenTasks(project.id)}
              onDiscuss={onOpenSteward}
              itemId={outcomeId}
              onItemChange={setOutcomeId}
              onReviewNote={(draftId) => {
                setNoteDraftId(draftId)
                setPanel('context')
              }}
            />
          </PortfolioProjectBoard>
          <PortfolioPanel
            open={panel === 'context'}
            title={translate('portfolio.contextAndNotes', 'Context & notes')}
            description={translate(
              'portfolio.contextPanelHint',
              'What every agent on this initiative is told, and the notes they read.'
            )}
            onClose={() => {
              setPanel(null)
              setNoteDraftId('')
            }}
          >
            <div className="space-y-5">
              <PortfolioInitiativeContext project={project} repos={repos} />
              <PortfolioNotes
                key={`${project.id}:${noteDraftId}`}
                openDraftId={noteDraftId}
                state={state}
                projectId={project.id}
                busy={busy}
                onSave={onSave}
                onExport={onExportNotes}
              />
            </div>
          </PortfolioPanel>
          <PortfolioPanel
            open={panel === 'agents'}
            title={translate('portfolio.agents', 'Agents')}
            description={translate(
              'portfolio.agentsPanelHint',
              'The roles tasks are assigned to, each with its agent and responsibility.'
            )}
            onClose={() => setPanel(null)}
          >
            <PortfolioAgents
              roles={state.roles}
              busy={busy}
              onAddCoordinator={() =>
                void onSave({ kind: 'role.create', role: PORTFOLIO_OUTCOME_COORDINATOR })
              }
              onCreateRole={() => {
                setPanel(null)
                setComposer('role')
              }}
              onEditRole={(roleId) => {
                setPanel(null)
                setEditingRoleId(roleId)
                setComposer('role.edit')
              }}
            />
          </PortfolioPanel>
          <PortfolioPanel
            open={panel === 'features'}
            title={translate('portfolio.featureCatalog', 'Feature catalog')}
            description={translate(
              'portfolio.featuresHint',
              'The product capabilities this initiative maintains, each with its current specification. Outcomes that change a feature publish their specification here.'
            )}
            onClose={() => setPanel(null)}
          >
            <PortfolioFeatures
              view="features"
              key={`features:${project.id}`}
              state={state}
              projectId={project.id}
              draftScope={draftScope}
              busy={busy}
              error={error}
              onSave={onSave}
              onCreateTask={(id) => {
                setTaskWorkItemId(id)
                setComposer('task')
              }}
              onSelectTask={setSelectedTaskId}
              onCreateRole={() => setComposer('role')}
              onOpenTasks={() => onOpenTasks(project.id)}
              onDiscuss={onOpenSteward}
              onOpenOutcome={(id) => {
                setPanel(null)
                setOutcomeId(id)
              }}
            />
          </PortfolioPanel>
        </div>
      ) : (
        <PortfolioWelcome
          roleCount={state.roles.length}
          onCreateProject={() => setComposer('project')}
          onCreateIdea={() => setComposer('project.idea')}
          onCreateRole={() => setComposer('role')}
        />
      )}
      {composer === 'project' || composer === 'project.edit' || composer === 'project.idea' ? (
        <PortfolioProjectSetup
          key={`${draftScope}:${composer}:${project?.id ?? ''}`}
          draftKey={JSON.stringify([
            draftScope,
            composer === 'project.edit' ? 'edit' : 'new',
            composer === 'project.edit' ? project?.id : null
          ])}
          state={state}
          projectId={project?.id ?? ''}
          editing={composer === 'project.edit'}
          fromIdea={composer === 'project.idea'}
          repos={repos}
          actions={setupActions}
          busy={busy}
          saveError={error}
          onSave={onSave}
          onClose={() => setComposer(null)}
        />
      ) : (
        composer &&
        (composer !== 'role.edit' || editingRole) && (
          <PortfolioComposer
            key={`${composer}:${project?.id ?? ''}:${editingRole?.id ?? ''}`}
            kind={composer === 'role.edit' ? 'role' : composer}
            role={editingRole}
            workItemId={taskWorkItemId || undefined}
            state={state}
            projectId={project?.id ?? ''}
            busy={busy}
            saveError={error}
            onClose={() => setComposer(null)}
            onSave={onSave}
          />
        )
      )}
      {selectedTask && (
        <PortfolioTaskDetail
          key={selectedTask.id}
          state={state}
          task={selectedTask}
          roleName={portfolioRoleLabelById(state, selectedTask.roleId)}
          workspaces={projectWorkspaces}
          activity={observation}
          reviewComments={reviewComments}
          busy={busy}
          saveError={error}
          onClose={() => setSelectedTaskId('')}
          onSave={onSave}
          onLaunch={onLaunch}
          onOpenWorkspace={onOpenWorkspace}
          onReviewChanges={onReviewChanges}
        />
      )}
    </div>
  )
}
