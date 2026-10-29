import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, FolderKanban, Pencil, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import {
  portfolioProgress,
  type PortfolioCommand,
  type PortfolioState
} from '../../../../shared/portfolio'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import { PortfolioComposer, type PortfolioComposerKind } from './PortfolioComposer'
import { PortfolioTaskDetail, type PortfolioWorkspace } from './PortfolioTaskDetail'
import { PortfolioWelcome } from './PortfolioWelcome'
import { PortfolioNavigation } from './PortfolioNavigation'
import { PortfolioProjectBoard } from './PortfolioProjectBoard'
import { PortfolioProjectSetup } from './PortfolioProjectSetup'
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
  setupActions: PortfolioSetupActions
  draftScope: string
}): React.JSX.Element {
  useTranslation()
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [composer, setComposer] = useState<PortfolioComposerKind | null>(null)
  const project =
    state.projects.find((entry) => entry.id === selectedProjectId) ?? state.projects[0]
  const tasks = state.tasks.filter((task) => task.projectId === project?.id)
  const selectedTask = tasks.find((task) => task.id === selectedTaskId)
  const projectWorkspaces = workspaces.filter((workspace) =>
    project?.repoIds.includes(workspace.repoId)
  )
  const progress = portfolioProgress(state.tasks)
  const attempt = selectedTask?.attempts.at(-1)
  const observation = attempt
    ? Object.values(activity).find(
        (entry) =>
          ((attempt.paneKey && entry.paneKey === attempt.paneKey) ||
            (attempt.handle && entry.terminalHandle === attempt.handle)) &&
          !entry.restoredUnconfirmed &&
          (entry.evidenceObservedAt ?? entry.updatedAt) >= attempt.createdAt
      )
    : undefined

  return (
    <div className="@container flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <FolderKanban className="size-4 text-muted-foreground" aria-hidden="true" />
            <h1 className="text-base font-semibold">
              {translate('portfolio.navigation', 'Projects')}
            </h1>
          </div>
          <Button
            variant="ghost"
            size="xs"
            className="-ml-1.5 max-w-full justify-start"
            aria-label={translate('portfolio.renameOrganization', 'Rename organization')}
            onClick={() => setComposer('organization')}
          >
            <Building2 className="shrink-0" aria-hidden="true" />
            <span className="min-w-0 truncate text-left">{state.organization}</span>
            <Pencil className="shrink-0" aria-hidden="true" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={translate('portfolio.refresh', 'Refresh')}
                disabled={busy}
                onClick={onRefresh}
              >
                <RefreshCw aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              {translate('portfolio.refresh', 'Refresh')}
            </TooltipContent>
          </Tooltip>
          {state.projects.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setComposer('project')}>
              <Plus aria-hidden="true" />
              {translate('portfolio.newProject', 'New project')}
            </Button>
          )}
        </div>
        {progress.total > 0 && (
          <p className="w-full text-xs text-muted-foreground">
            {translate(
              'portfolio.overview',
              '{{accepted}} of {{total}} tasks accepted · {{percent}}% complete',
              progress
            )}
          </p>
        )}
      </header>
      {error && (
        <p role="alert" className="border-b border-border px-5 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-sleek @3xl:flex-row">
        {project ? (
          <>
            <PortfolioNavigation
              state={state}
              selectedProjectId={project.id}
              onSelectProject={setSelectedProjectId}
              onCreateRole={() => setComposer('role')}
            />
            <PortfolioProjectBoard
              project={project}
              tasks={tasks}
              roles={state.roles}
              repos={repos}
              onEditProject={() => setComposer('project.edit')}
              onCreateTask={() => setComposer('task')}
              onCreateRole={() => setComposer('role')}
              onSelectTask={setSelectedTaskId}
            />
          </>
        ) : (
          <PortfolioWelcome
            roleCount={state.roles.length}
            onCreateProject={() => setComposer('project')}
            onCreateIdea={() => setComposer('project.idea')}
            onCreateRole={() => setComposer('role')}
          />
        )}
      </div>
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
        composer && (
          <PortfolioComposer
            key={`${composer}:${project?.id ?? ''}`}
            kind={composer}
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
          task={selectedTask}
          roleName={state.roles.find((role) => role.id === selectedTask.roleId)?.name ?? ''}
          workspaces={projectWorkspaces}
          activity={observation}
          busy={busy}
          saveError={error}
          onClose={() => setSelectedTaskId('')}
          onSave={onSave}
          onLaunch={onLaunch}
          onOpenWorkspace={onOpenWorkspace}
        />
      )}
    </div>
  )
}
