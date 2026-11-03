import { useState } from 'react'
import { CircleAlert, CircleCheck, CircleDashed, Gavel, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store'
import { useNow } from '@/hooks/use-now'
import { translate } from '@/i18n/i18n'
import type { PortfolioCommand, PortfolioTask } from '../../../../shared/portfolio'
import { portfolioRoleLabelById } from '../../../../shared/portfolio-roles'
import { PortfolioSelect } from './portfolio-controls'
import { PortfolioTaskDetail } from './PortfolioTaskDetail'
import {
  portfolioTaskLane,
  portfolioTaskObservation,
  type PortfolioTaskAttention,
  type PortfolioTaskLane
} from './portfolio-task-lanes'
import { usePortfolioWorkbench } from './use-portfolio-workbench'
import {
  openPortfolioTaskChanges,
  usePortfolioTaskReviewComments
} from './portfolio-task-review-actions'

const ALL_PROJECTS = 'all'

function laneMeta(lane: Exclude<PortfolioTaskLane, 'accepted'>) {
  switch (lane) {
    case 'decide':
      return {
        name: translate('portfolio.laneDecide', 'Needs your decision'),
        hint: translate('portfolio.laneDecideHint', 'Results submitted for your review'),
        icon: Gavel
      }
    case 'attention':
      return {
        name: translate('portfolio.laneAttention', 'Needs attention'),
        hint: translate('portfolio.laneAttentionHint', 'Stopped, blocked, or waiting for you'),
        icon: CircleAlert
      }
    case 'running':
      return {
        name: translate('portfolio.laneRunning', 'In progress'),
        hint: translate('portfolio.laneRunningHint', 'Agents working now'),
        icon: LoaderCircle
      }
    case 'ready':
      return {
        name: translate('portfolio.laneReady', 'Ready to start'),
        hint: translate('portfolio.laneReadyHint', 'Planned and not started'),
        icon: CircleDashed
      }
  }
}

function attentionLabel(attention: PortfolioTaskAttention): string {
  switch (attention) {
    case 'blocked':
      return translate('portfolio.attentionBlocked', 'Marked blocked')
    case 'launch-uncertain':
      return translate('portfolio.attentionLaunch', 'Launch outcome unknown')
    case 'agent-needs-input':
      return translate('portfolio.attentionInput', 'Agent is waiting for input')
    case 'agent-stopped':
      return translate('portfolio.attentionStopped', 'Agent stopped without submitting')
    case 'agent-unseen':
      return translate('portfolio.attentionUnseen', 'No agent activity observed')
  }
}

// Workbench tasks in the Tasks page, grouped by who has to act next.
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
  // A launch that stays silent past its grace period moves to "Needs attention" without new data.
  const now = useNow(30_000)
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
  const tasks = state.tasks
    .filter((task) => projectId === ALL_PROJECTS || task.projectId === projectId)
    .map((task) => {
      const observation = portfolioTaskObservation(task, activity)
      return { task, observation, ...portfolioTaskLane(task, observation, now) }
    })
  const selected = tasks.find((entry) => entry.task.id === selectedTaskId)
  const accepted = tasks.filter((entry) => entry.lane === 'accepted')
  const card = (entry: (typeof tasks)[number]) => (
    <PortfolioTaskQueueCard
      key={entry.task.id}
      task={entry.task}
      projectName={
        projectId === ALL_PROJECTS
          ? state.projects.find((project) => project.id === entry.task.projectId)?.name
          : undefined
      }
      roleName={portfolioRoleLabelById(state, entry.task.roleId)}
      detail={
        entry.attention
          ? attentionLabel(entry.attention)
          : entry.lane === 'running'
            ? entry.observation?.lastAssistantMessage || entry.observation?.toolName
            : undefined
      }
      onSelect={() => setSelectedTaskId(entry.task.id)}
    />
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
      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
        {(['decide', 'attention', 'running', 'ready'] as const).map((lane) => {
          const meta = laneMeta(lane)
          const laneTasks = tasks.filter((entry) => entry.lane === lane)
          return (
            <section
              key={lane}
              aria-label={meta.name}
              className="min-w-0 rounded-md border border-border/50 bg-muted/50 p-2 shadow-sm"
            >
              <h3 className="flex items-center gap-2 px-1 pt-1 text-xs font-medium">
                <meta.icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                {meta.name}
                <span className="ml-auto tabular-nums text-muted-foreground">
                  {laneTasks.length}
                </span>
              </h3>
              <p className="mb-2 px-1 text-xs text-muted-foreground">{meta.hint}</p>
              <div className="space-y-2">
                {laneTasks.map(card)}
                {laneTasks.length === 0 && (
                  <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                    {translate('portfolio.noTasks', 'No tasks')}
                  </p>
                )}
              </div>
            </section>
          )
        })}
      </div>
      {accepted.length > 0 && (
        <details className="rounded-md border border-border/50 p-2">
          <summary className="flex cursor-pointer items-center gap-2 px-1 text-xs font-medium">
            <CircleCheck className="size-3.5 text-muted-foreground" aria-hidden="true" />
            {translate('portfolio.acceptedCount', 'Accepted ({{count}})', {
              count: accepted.length,
              defaultValue_one: 'Accepted ({{count}})'
            })}
          </summary>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
            {accepted.map(card)}
          </div>
        </details>
      )}
      {selected && (
        <PortfolioTaskDetail
          key={selected.task.id}
          task={selected.task}
          roleName={portfolioRoleLabelById(state, selected.task.roleId)}
          workspaces={workspaces.filter((workspace) =>
            state.projects
              .find((project) => project.id === selected.task.projectId)
              ?.repoIds.includes(workspace.repoId)
          )}
          activity={selected.observation}
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

function PortfolioTaskQueueCard({
  task,
  projectName,
  roleName,
  detail,
  onSelect
}: {
  task: PortfolioTask
  projectName?: string
  roleName: string
  detail?: string
  onSelect: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full space-y-1.5 rounded-md border border-border bg-card p-3 text-left text-card-foreground shadow-xs outline-none hover:border-muted-foreground/35 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="block break-words text-sm font-medium leading-relaxed">{task.title}</span>
      <span className="block break-words text-xs text-muted-foreground">
        {[projectName, roleName].filter(Boolean).join(' · ')}
      </span>
      {detail && (
        <span className="line-clamp-2 block break-words text-xs text-muted-foreground">
          {detail}
        </span>
      )}
    </button>
  )
}
