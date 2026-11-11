import { useState, type ReactNode } from 'react'
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
import { CommentMarkdownAsync } from '@/components/sidebar/comment-markdown-lazy'
import { useNow } from '@/hooks/use-now'
import { getIntlLocale, translate } from '@/i18n/i18n'
import type {
  PortfolioCodeReview,
  PortfolioCommand,
  PortfolioState,
  PortfolioTask
} from '../../../../shared/portfolio'
import { portfolioAcceptBlocker } from '../../../../shared/portfolio-task-stages'
import {
  portfolioStageOutdated,
  portfolioSubmittedCommit,
  portfolioTrackTask
} from '../../../../shared/portfolio-track-commits'
import { portfolioTrackRole } from '../../../../shared/portfolio-ticket-roles'
import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'
import { PortfolioField } from './portfolio-controls'
import { PortfolioTaskDecision } from './PortfolioTaskDecision'
import { portfolioTaskLane } from './portfolio-task-lanes'
import {
  requestPortfolioTriage,
  returnPortfolioFindingsToDevelopment,
  type PortfolioTaskReviewComments
} from './portfolio-task-review-actions'
import { stageName, taskNextStep } from './portfolio-track-labels'
import { PortfolioTaskSteps } from './PortfolioTaskSteps'
import { PortfolioTaskTriage } from './PortfolioTaskTriage'
import { PortfolioEndExecution } from './PortfolioEndExecution'
import { PortfolioTaskStart } from './PortfolioTaskStart'
import { PortfolioTaskPush } from './PortfolioTaskPush'

export type PortfolioWorkspace = { id: string; repoId: string; name: string }

function Markdown({ content }: { content: string }): React.JSX.Element {
  return <CommentMarkdownAsync content={content} variant="document" className="text-sm" />
}

function Collapsible({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group rounded-md border border-border">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">{title}</summary>
      <div className="border-t border-border px-3 py-3">{children}</div>
    </details>
  )
}

export function PortfolioTaskDetail({
  state,
  task,
  roleName,
  workspaces,
  activity,
  reviewComments,
  busy,
  saveError,
  onClose,
  onSave,
  onLaunch,
  onOpenWorkspace,
  onReviewChanges
}: {
  state: PortfolioState
  task: PortfolioTask
  roleName: string
  workspaces: readonly PortfolioWorkspace[]
  activity?: AgentStatusEntry
  reviewComments?: PortfolioTaskReviewComments
  busy: boolean
  saveError: string
  onClose: () => void
  onSave: (command: PortfolioCommand) => Promise<boolean>
  onLaunch: (taskId: string, worktreeId: string) => Promise<boolean>
  onOpenWorkspace: (id: string) => void
  onReviewChanges?: (worktreeId: string) => void
}): React.JSX.Element {
  const [note, setNote] = useState('')
  const [relayNotice, setRelayNotice] = useState('')
  const submittedCommit =
    task.status === 'review' || task.status === 'accepted'
      ? portfolioSubmittedCommit(task)
      : undefined
  const [codeReview, setCodeReview] = useState<PortfolioCodeReview | null>(
    reviewComments?.total ? 'reviewed' : null
  )
  const now = useNow(30_000)
  const attempt = task.attempts.at(-1)
  const unresolved = attempt && (attempt.state === 'pending' || attempt.state === 'unknown')
  const { lane, attention } = portfolioTaskLane(
    task,
    activity,
    now,
    !!portfolioStageOutdated(state, task)
  )
  const canStart = task.status === 'todo' && (!attempt || attempt.state === 'closed')
  const acceptBlocker = lane === 'decide' ? portfolioAcceptBlocker(state, task) : undefined
  const workspaceName = workspaces.find((entry) => entry.id === attempt?.worktreeId)?.name
  const reviewer = portfolioTrackRole(state, task) === 'reviewer'
  async function transition(
    status: 'todo' | 'blocked' | 'review' | 'accepted',
    fallbackNote?: string
  ): Promise<void> {
    const command: PortfolioCommand = {
      kind: 'task.transition',
      taskId: task.id,
      status,
      note: note.trim() || fallbackNote || note,
      ...(status === 'accepted' && codeReview ? { codeReview } : {})
    }
    if (await onSave(command)) {
      setNote('')
    }
  }
  async function sendBack(): Promise<void> {
    if (task.stage === 'development') {
      return
    }
    const notice = await returnPortfolioFindingsToDevelopment(
      () => onSave({ kind: 'task.sendBack', taskId: task.id, note }),
      portfolioTrackTask(state, task, 'development'),
      task.stage,
      note,
      task.id
    )
    if (notice !== false) {
      setNote('')
      setRelayNotice(notice)
    }
  }
  async function requestTriage(feedback: string): Promise<boolean> {
    const notice = await requestPortfolioTriage(
      () => onSave({ kind: 'task.requestTriage', taskId: task.id, note: feedback }),
      task,
      feedback,
      reviewer
    )
    if (notice !== false) {
      setRelayNotice(notice)
    }
    return notice !== false
  }
  const endExecution = attempt && attempt.state !== 'closed' && (
    <PortfolioEndExecution taskId={task.id} busy={busy} onSave={onSave} />
  )
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
            <SheetDescription>
              {[stageName(task.stage), roleName, attempt?.agent, workspaceName]
                .filter(Boolean)
                .join(' · ')}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-5 p-4 text-sm">
            {saveError && (
              <p role="alert" className="text-destructive">
                {saveError}
              </p>
            )}
            <section
              aria-label={translate('portfolio.nextStep', 'Next step')}
              className="space-y-3 rounded-md border border-foreground/20 bg-muted/40 p-3"
            >
              <h3 className="text-xs font-medium uppercase text-muted-foreground">
                {translate('portfolio.nextStep', 'Next step')}
              </h3>
              <p className="leading-relaxed">
                {acceptBlocker && task.stage === 'development'
                  ? translate(
                      'portfolio.nextLaterStages',
                      'Development is submitted. Code review and QA run next from the Tasks page; accept development after they are accepted.'
                    )
                  : taskNextStep(lane, attention)}
              </p>
              {relayNotice && (
                <p role="alert" className="whitespace-pre-wrap text-destructive">
                  {relayNotice}
                </p>
              )}
              {attempt?.warning && (
                <p role="alert" className="whitespace-pre-wrap text-destructive">
                  {attempt.warning}
                </p>
              )}
              {lane === 'running' && activity && (
                <p className="line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
                  {activity.lastAssistantMessage || activity.toolName}
                </p>
              )}
              <PortfolioTaskStart
                state={state}
                task={task}
                workspaces={workspaces}
                busy={busy}
                onLaunch={onLaunch}
                onSave={onSave}
                onNotice={setRelayNotice}
              />
              <PortfolioTaskPush
                state={state}
                task={task}
                busy={busy}
                onSave={onSave}
                onNotice={setRelayNotice}
              />
              {attempt && !canStart && lane !== 'accepted' && (
                <div className="flex flex-wrap gap-2">
                  {unresolved && (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => void onLaunch(task.id, attempt.worktreeId)}
                    >
                      {translate('portfolio.retryLaunch', 'Retry original launch')}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenWorkspace(attempt.worktreeId)}
                  >
                    {translate('portfolio.openWorkspace', 'Open workspace')}
                  </Button>
                </div>
              )}
              {(attention === 'agent-stopped' || attention === 'agent-unseen') && endExecution}
              {lane === 'decide' && attempt && (
                <PortfolioTaskDecision
                  stage={task.stage}
                  reviewer={reviewer}
                  evidence={task.evidence}
                  acceptBlocker={acceptBlocker}
                  busy={busy}
                  note={note}
                  onNoteChange={setNote}
                  codeReview={codeReview}
                  onCodeReviewChange={setCodeReview}
                  reviewComments={reviewComments}
                  onReviewChanges={onReviewChanges && (() => onReviewChanges(attempt.worktreeId))}
                  onAccept={() =>
                    void transition('accepted', translate('portfolio.accepted', 'Accepted'))
                  }
                  onReturn={() =>
                    void (task.stage === 'development' ? transition('todo') : sendBack())
                  }
                />
              )}
            </section>
            {task.stage !== 'development' &&
              (reviewer ||
                state.projects.find((project) => project.id === task.projectId)?.reviewMode ===
                  'team') && (
                <PortfolioTaskTriage
                  state={state}
                  task={task}
                  busy={busy}
                  onRequestTriage={requestTriage}
                />
              )}
            {task.stage === 'development' && <PortfolioTaskSteps steps={task.steps} />}
            {task.evidence && (
              <section className="space-y-2">
                <h3 className="font-medium">
                  {translate('portfolio.evidence', 'Submitted evidence')}
                </h3>
                {submittedCommit && (
                  <p className="text-xs text-muted-foreground">
                    {translate('portfolio.submittedCommit', 'Submitted at commit {{commit}}', {
                      commit: submittedCommit.slice(0, 10)
                    })}
                  </p>
                )}
                <Markdown content={task.evidence} />
              </section>
            )}
            <section className="space-y-2">
              <h3 className="font-medium">
                {translate('portfolio.acceptanceCriteria', 'Acceptance criteria')}
              </h3>
              <Markdown content={task.acceptanceCriteria} />
            </section>
            <Collapsible title={translate('portfolio.taskInstructions', 'Task instructions')}>
              <Markdown content={task.instructions} />
            </Collapsible>
            {!unresolved && lane !== 'decide' && lane !== 'accepted' && (
              <Collapsible title={translate('portfolio.moreActions', 'More actions')}>
                <div className="space-y-3">
                  <PortfolioField
                    label={translate('portfolio.reviewNote', 'Evidence or review note')}
                  >
                    <Textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      rows={3}
                      maxLength={20000}
                    />
                  </PortfolioField>
                  <div className="flex flex-wrap gap-2">
                    {task.status !== 'todo' && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy || !note.trim()}
                        onClick={() => void transition('review')}
                      >
                        {translate('portfolio.submitReview', 'Submit for review')}
                      </Button>
                    )}
                    {task.status !== 'todo' && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy || !note.trim()}
                        onClick={() => void transition('todo')}
                      >
                        {translate('portfolio.reopen', 'Return to planned')}
                      </Button>
                    )}
                    {task.status !== 'blocked' && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy || !note.trim()}
                        onClick={() => void transition('blocked')}
                      >
                        {translate('portfolio.block', 'Mark blocked')}
                      </Button>
                    )}
                  </div>
                  {attention !== 'agent-stopped' && attention !== 'agent-unseen' && endExecution}
                </div>
              </Collapsible>
            )}
            <Collapsible title={translate('portfolio.history', 'History')}>
              <div className="space-y-3">
                {task.history.toReversed().map((event) => (
                  <div key={event.id} className="border-l pl-3">
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.at).toLocaleString(getIntlLocale())} · {event.status}
                      {event.commit && (
                        <Badge variant="outline" className="ml-2 font-mono">
                          {event.commit.slice(0, 10)}
                        </Badge>
                      )}
                      {event.codeReview && (
                        <Badge variant="outline" className="ml-2">
                          {event.codeReview === 'reviewed'
                            ? translate('portfolio.historyReviewed', 'code reviewed')
                            : translate('portfolio.historySkipped', 'code review skipped')}
                        </Badge>
                      )}
                    </p>
                    <p className="whitespace-pre-wrap">{event.note}</p>
                  </div>
                ))}
              </div>
            </Collapsible>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
