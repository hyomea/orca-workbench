import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { getIntlLocale, translate } from '@/i18n/i18n'
import type { PortfolioCommand, PortfolioTask } from '../../../../shared/portfolio'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import { PortfolioField, PortfolioSelect } from './portfolio-controls'

export type PortfolioWorkspace = { id: string; repoId: string; name: string }

export function PortfolioTaskDetail({
  task,
  roleName,
  workspaces,
  activity,
  busy,
  saveError,
  onClose,
  onSave,
  onLaunch,
  onOpenWorkspace
}: {
  task: PortfolioTask
  roleName: string
  workspaces: readonly PortfolioWorkspace[]
  activity?: AgentStatusEntry
  busy: boolean
  saveError: string
  onClose: () => void
  onSave: (command: PortfolioCommand) => Promise<boolean>
  onLaunch: (taskId: string, worktreeId: string) => Promise<boolean>
  onOpenWorkspace: (id: string) => void
}): React.JSX.Element {
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? '')
  const [note, setNote] = useState('')
  const attempt = task.attempts.at(-1)
  const unresolved = attempt && (attempt.state === 'pending' || attempt.state === 'unknown')
  async function transition(status: 'todo' | 'blocked' | 'review' | 'accepted'): Promise<void> {
    if (await onSave({ kind: 'task.transition', taskId: task.id, status, note })) {
      setNote('')
    }
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !busy) {
          onClose()
        }
      }}
    >
      <SheetContent>
        <div className="min-h-0 overflow-y-auto scrollbar-sleek">
          <SheetHeader>
            <SheetTitle>{task.title}</SheetTitle>
            <SheetDescription>{roleName}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-5 p-4 text-sm">
            {saveError && (
              <p role="alert" className="text-destructive">
                {saveError}
              </p>
            )}
            <p className="whitespace-pre-wrap">{task.instructions}</p>
            <section className="space-y-2">
              <h3 className="font-medium">
                {translate('portfolio.acceptanceCriteria', 'Acceptance criteria')}
              </h3>
              <p className="whitespace-pre-wrap text-muted-foreground">{task.acceptanceCriteria}</p>
            </section>
            {task.status === 'todo' && (!attempt || attempt.state === 'closed') && (
              <div className="space-y-3">
                <PortfolioSelect
                  label={translate('portfolio.workspace', 'Execution workspace')}
                  value={workspaceId}
                  onChange={setWorkspaceId}
                  options={workspaces}
                  disabled={busy}
                />
                <p className="text-xs text-muted-foreground">
                  {translate(
                    'portfolio.launchHelp',
                    'Starts the assigned agent with this task and role in the selected workspace. Use a separate workspace for concurrent work.'
                  )}
                </p>
                {!workspaces.length && (
                  <p className="text-sm text-muted-foreground">
                    {translate(
                      'portfolio.noWorkspace',
                      'Open a local workspace from a linked repository or folder first.'
                    )}
                  </p>
                )}
                <Button
                  disabled={busy || !workspaceId}
                  onClick={() => void onLaunch(task.id, workspaceId)}
                >
                  {busy
                    ? translate('portfolio.launching', 'Starting agent…')
                    : translate('portfolio.startAgent', 'Start agent')}
                </Button>
              </div>
            )}
            {attempt && (
              <section className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {translate('portfolio.execution', 'Execution')}
                  </span>
                  <Badge variant="outline">{attempt.agent}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(attempt.createdAt).toLocaleString(getIntlLocale())}
                </p>
                {unresolved && (
                  <p>
                    {translate(
                      'portfolio.unknownLaunch',
                      'Launch outcome is unresolved. Retry checks the original request; it does not request a new execution.'
                    )}
                  </p>
                )}
                {attempt.warning && (
                  <p role="alert" className="whitespace-pre-wrap text-destructive">
                    {attempt.warning}
                  </p>
                )}
                {activity ? (
                  <div className="space-y-2">
                    <p>
                      {translate('portfolio.lastObserved', 'Last observed')}: {activity.state} ·{' '}
                      {new Date(
                        activity.evidenceObservedAt ?? activity.updatedAt
                      ).toLocaleTimeString(getIntlLocale())}
                    </p>
                    <p className="whitespace-pre-wrap text-muted-foreground">
                      {activity.lastAssistantMessage || activity.toolName}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    {translate(
                      'portfolio.noObservation',
                      'No confirmed status observation for this execution.'
                    )}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => onOpenWorkspace(attempt.worktreeId)}>
                    {translate('portfolio.openWorkspace', 'Open workspace')}
                  </Button>
                  {unresolved && (
                    <Button
                      disabled={busy}
                      onClick={() => void onLaunch(task.id, attempt.worktreeId)}
                    >
                      {translate('portfolio.retryLaunch', 'Retry original launch')}
                    </Button>
                  )}
                </div>
              </section>
            )}
            {task.evidence && (
              <section className="space-y-2">
                <h3 className="font-medium">
                  {translate('portfolio.evidence', 'Submitted evidence')}
                </h3>
                <p className="whitespace-pre-wrap">{task.evidence}</p>
              </section>
            )}
            <section className="space-y-3">
              <PortfolioField label={translate('portfolio.reviewNote', 'Evidence or review note')}>
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={4}
                  maxLength={20000}
                />
              </PortfolioField>
              <p className="text-xs text-muted-foreground">
                {translate(
                  'portfolio.reviewHelp',
                  'Include verification results and links. Only acceptance counts toward project progress. Changing status does not stop the agent.'
                )}
              </p>
              {!unresolved && (
                <div className="flex flex-wrap gap-2">
                  {task.status === 'review' ? (
                    <Button
                      disabled={busy || !note.trim()}
                      onClick={() => void transition('accepted')}
                    >
                      {translate('portfolio.accept', 'Accept result')}
                    </Button>
                  ) : (
                    task.status !== 'accepted' && (
                      <Button
                        disabled={busy || !note.trim()}
                        onClick={() => void transition('review')}
                      >
                        {translate('portfolio.submitReview', 'Submit for review')}
                      </Button>
                    )
                  )}
                  {task.status !== 'todo' && (
                    <Button
                      variant="outline"
                      disabled={busy || !note.trim()}
                      onClick={() => void transition('todo')}
                    >
                      {translate('portfolio.reopen', 'Return to planned')}
                    </Button>
                  )}
                  {task.status !== 'blocked' && task.status !== 'accepted' && (
                    <Button
                      variant="outline"
                      disabled={busy || !note.trim()}
                      onClick={() => void transition('blocked')}
                    >
                      {translate('portfolio.block', 'Mark blocked')}
                    </Button>
                  )}
                </div>
              )}
              {attempt && attempt.state !== 'closed' && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {translate(
                      'portfolio.closeExecutionHelp',
                      'To allow a new execution, inspect the workspace and stop the previous agent first. Record what you checked above.'
                    )}
                  </p>
                  <Button
                    variant="outline"
                    disabled={busy || !note.trim()}
                    onClick={() =>
                      void onSave({ kind: 'task.closeExecution', taskId: task.id, note })
                    }
                  >
                    {translate('portfolio.confirmStopped', 'I have stopped this execution')}
                  </Button>
                </div>
              )}
            </section>
            <section className="space-y-3">
              <h3 className="font-medium">{translate('portfolio.history', 'History')}</h3>
              {task.history.toReversed().map((event) => (
                <div key={event.id} className="border-l pl-3">
                  <p className="text-xs text-muted-foreground">
                    {new Date(event.at).toLocaleString(getIntlLocale())} · {event.status}
                  </p>
                  <p className="whitespace-pre-wrap">{event.note}</p>
                </div>
              ))}
            </section>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
