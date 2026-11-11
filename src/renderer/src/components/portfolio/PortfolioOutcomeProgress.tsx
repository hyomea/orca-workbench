import { useState } from 'react'
import { ChevronRight, CircleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { PortfolioCommand, PortfolioState } from '../../../../shared/portfolio'
import type { PortfolioWorkItem } from '../../../../shared/portfolio-features'
import { portfolioWorkingRoles } from '../../../../shared/portfolio-roles'
import { PortfolioSelect } from './portfolio-controls'
import { ticketRoleName, workPlatformName } from './portfolio-feature-labels'
import { outcomePhaseName, stageName } from './portfolio-track-labels'
import { portfolioOutcomePhase } from './portfolio-outcome-phase'
import { portfolioTicketLabel, type PortfolioTrack } from './portfolio-tracks'

export function PortfolioOutcomePhaseBadge({
  state,
  item,
  tracks
}: {
  state: PortfolioState
  item: PortfolioWorkItem
  tracks: readonly PortfolioTrack[]
}): React.JSX.Element {
  const { phase, attention } = portfolioOutcomePhase(state, item, tracks)
  const label = translate('portfolio.trackNeedsAttention', 'Needs attention')
  return (
    <Badge variant="secondary" title={attention ? label : undefined}>
      {attention && <CircleAlert className="size-3 text-destructive" aria-label={label} />}
      {outcomePhaseName(phase)}
    </Badge>
  )
}

function trackStatus(track: PortfolioTrack): string {
  switch (track.current) {
    case 'external':
      return translate('portfolio.trackTracked', 'Tracked')
    case 'done':
      return translate('portfolio.trackDone', 'Done')
    case 'merge':
      return translate('portfolio.phaseMerge', 'Waiting to merge')
  }
  const stage = stageName(track.current)
  switch (track.next) {
    case 'plan':
      return `${stage} · ${translate('portfolio.trackNotPlanned', 'Not planned')}`
    case 'decide':
      return `${stage} · ${translate('portfolio.trackDecide', 'Needs your decision')}`
    case 'attention':
      return `${stage} · ${translate('portfolio.trackNeedsAttention', 'Needs attention')}`
    case 'start':
      return `${stage} · ${translate('portfolio.trackStart', 'Ready to start')}`
    case 'agent':
      return `${stage} · ${translate('portfolio.trackWorking', 'Agent working')}`
    default:
      return stage
  }
}

// Where each of the outcome's tickets stands. The work itself runs on the Tasks page.
export function PortfolioOutcomeProgress({
  state,
  item,
  tracks,
  busy,
  onSave,
  onOpenTasks,
  onCreateTask,
  onCreateRole
}: {
  state: PortfolioState
  item: PortfolioWorkItem
  tracks: readonly PortfolioTrack[]
  busy: boolean
  onSave: (command: PortfolioCommand) => Promise<boolean>
  onOpenTasks: () => void
  onCreateTask: (workItemId: string) => void
  onCreateRole: () => void
}): React.JSX.Element | null {
  const [linkId, setLinkId] = useState('')
  if (item.kind === 'investigation') {
    return null
  }
  const own = tracks.filter((track) => track.item?.id === item.id)
  const open = item.status !== 'accepted'
  const canAssign = portfolioWorkingRoles(state).length > 0
  const available = state.tasks.filter(
    (task) =>
      task.projectId === item.projectId &&
      !task.workItemId &&
      task.status === 'todo' &&
      (!task.attempts.length || task.attempts.at(-1)?.state === 'closed')
  )
  return (
    <section
      aria-label={translate('portfolio.progress', 'Progress')}
      className="space-y-2 rounded-md border border-border p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-medium">{translate('portfolio.progress', 'Progress')}</h4>
        <div className="flex flex-wrap gap-2">
          {open && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => (canAssign ? onCreateTask(item.id) : onCreateRole())}
            >
              {canAssign
                ? translate('portfolio.newTask', 'New task')
                : translate('portfolio.newRole', 'New role')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onOpenTasks}>
            {translate('portfolio.openInTasks', 'Open in Tasks')}
          </Button>
        </div>
      </div>
      {!own.length ? (
        <p className="text-sm text-muted-foreground">
          {translate(
            'portfolio.noTracks',
            'No tickets or tasks yet. Add tickets in “Tickets, parity, and feature”, or plan the work with the coordinator.'
          )}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {own.map((track) => (
            <li key={track.key}>
              <button
                type="button"
                onClick={onOpenTasks}
                className="flex w-full items-center gap-3 py-2 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0 flex-1">
                  <span className="font-medium">
                    {track.platform
                      ? workPlatformName(track.platform)
                      : translate('portfolio.trackNoPlatform', 'No platform')}
                  </span>
                  {track.ticket && (
                    <span className="ml-1.5 text-muted-foreground" title={track.ticket}>
                      {portfolioTicketLabel(track.ticket)}
                    </span>
                  )}
                  {track.role !== 'author' && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      {ticketRoleName(track.role)}
                    </span>
                  )}
                </span>
                <span
                  className={
                    track.next === 'attention'
                      ? 'text-xs text-destructive'
                      : 'text-xs text-muted-foreground'
                  }
                >
                  {trackStatus(track)}
                </span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && available.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <PortfolioSelect
              label={translate('portfolio.existingTask', 'Existing planned task')}
              value={linkId}
              onChange={setLinkId}
              disabled={busy}
              options={available.map((task) => ({ id: task.id, name: task.title }))}
            />
          </div>
          <Button
            variant="outline"
            disabled={busy || !linkId}
            onClick={async () => {
              if (
                await onSave({ kind: 'task.linkWorkItem', taskId: linkId, workItemId: item.id })
              ) {
                setLinkId('')
              }
            }}
          >
            {translate('portfolio.linkTask', 'Link task')}
          </Button>
        </div>
      )}
    </section>
  )
}
