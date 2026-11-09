import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { PortfolioCommand } from '../../../../shared/portfolio'
import { portfolioRoleLabelById } from '../../../../shared/portfolio-roles'
import { PortfolioSelect } from './portfolio-controls'
import { PortfolioTaskDetail } from './PortfolioTaskDetail'
import { portfolioTaskObservation } from './portfolio-task-lanes'
import { PortfolioTrackBoard } from './PortfolioTrackBoard'
import { usePortfolioTracks } from './use-portfolio-tracks'
import { usePortfolioWorkbench } from './use-portfolio-workbench'
import {
  openPortfolioTaskChanges,
  usePortfolioTaskReviewComments
} from './portfolio-task-review-actions'

const ALL_PROJECTS = 'all'

// Workbench tasks in the Tasks page: each outcome platform as a development → review → QA → PR
// pipeline.
export function PortfolioTaskQueue({
  initialProjectId
}: {
  initialProjectId?: string
}): React.JSX.Element {
  const { state, error, loadError, busy, setError, refresh, mutate, workspaces } =
    usePortfolioWorkbench()
  const activity = useAppStore((s) => s.agentStatusByPaneKey)
  const setActiveWorktree = useAppStore((s) => s.setActiveWorktree)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const [projectId, setProjectId] = useState(initialProjectId ?? ALL_PROJECTS)
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const tracks = usePortfolioTracks(state, projectId === ALL_PROJECTS ? undefined : projectId)
  const reviewComments = usePortfolioTaskReviewComments(
    state?.tasks.find((task) => task.id === selectedTaskId)?.attempts.at(-1)?.worktreeId
  )
  if (!state) {
    return (
      <div className="mt-3 space-y-3 text-sm">
        <p role={loadError ? 'alert' : 'status'}>
          {loadError || translate('portfolio.loading', 'Loading initiatives…')}
        </p>
        {loadError && (
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            {translate('portfolio.retry', 'Retry')}
          </Button>
        )}
      </div>
    )
  }
  const selectedTask = state.tasks.find((task) => task.id === selectedTaskId)
  const selectedWorkspaces = workspaces.filter((workspace) =>
    state.projects
      .find((project) => project.id === selectedTask?.projectId)
      ?.repoIds.includes(workspace.repoId)
  )
  return (
    <div className="mt-3 flex min-h-0 flex-col gap-3 overflow-y-auto scrollbar-sleek">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-96 max-w-full">
          <PortfolioSelect
            label={translate('portfolio.projectFilter', 'Initiative')}
            value={projectId}
            onChange={setProjectId}
            options={[
              { id: ALL_PROJECTS, name: translate('portfolio.allProjects', 'All initiatives') },
              ...state.projects.map((project) => ({ id: project.id, name: project.name }))
            ]}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {translate(
            'portfolio.queueHint',
            'Plan features and tasks in Workbench; run and review them here.'
          )}
        </p>
      </div>
      {(error || loadError) && (
        <p role="alert" className="text-sm text-destructive">
          {error || loadError}
        </p>
      )}
      <PortfolioTrackBoard
        state={state}
        tracks={tracks}
        showProject={projectId === ALL_PROJECTS}
        onSelectTask={setSelectedTaskId}
      />
      {selectedTask && (
        <PortfolioTaskDetail
          key={selectedTask.id}
          state={state}
          task={selectedTask}
          roleName={portfolioRoleLabelById(state, selectedTask.roleId)}
          workspaces={selectedWorkspaces}
          activity={portfolioTaskObservation(selectedTask, activity)}
          reviewComments={reviewComments}
          busy={busy}
          saveError={error}
          onClose={() => setSelectedTaskId('')}
          onSave={(command: PortfolioCommand) => mutate('portfolio.mutate', { command })}
          onLaunch={(taskId, worktreeId) => mutate('portfolio.launch', { taskId, worktreeId })}
          onOpenWorkspace={(id) => {
            if (setActiveWorktree(id, 'local')) {
              setActiveView('terminal')
            }
          }}
          onReviewChanges={(id) => {
            openPortfolioTaskChanges(id).catch((failure: unknown) =>
              setError(failure instanceof Error ? failure.message : String(failure))
            )
          }}
        />
      )}
    </div>
  )
}
