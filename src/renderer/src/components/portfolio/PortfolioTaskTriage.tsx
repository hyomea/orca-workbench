import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { PRComment } from '../../../../shared/github/comment-types'
import type { PortfolioState, PortfolioTask } from '../../../../shared/portfolio'
import {
  portfolioSubmittedAt,
  portfolioSubmittedCommit,
  portfolioTrackTask
} from '../../../../shared/portfolio-task-stages'
import { portfolioTrackRole } from '../../../../shared/portfolio-ticket-roles'
import { PortfolioField } from './portfolio-controls'
import {
  prStatusLabel,
  usePortfolioPrLookup,
  usePortfolioPrRefresh,
  type PortfolioTrackPr
} from './portfolio-track-pr'

const MAX_FEEDBACK = 19000

function commentsText(comments: readonly PRComment[]): string {
  return comments
    .map((comment) => {
      const where = comment.path
        ? ` on ${comment.path}${comment.line ? `:${comment.line}` : ''}`
        : ''
      return `- ${comment.author}${where}: ${comment.body.trim()}\n  ${comment.url}`
    })
    .join('\n')
    .slice(0, MAX_FEEDBACK)
}

// PR comments posted since the code review last submitted, read through Orca's GitHub actions.
function useNewPrComments(pr: PortfolioTrackPr | undefined, since: number): PRComment[] {
  const fetchPRComments = useAppStore((s) => s.fetchPRComments)
  const [comments, setComments] = useState<PRComment[]>([])
  // The lookup builds new objects on every render; fetch again only when the PR itself changes.
  const target = JSON.stringify(
    pr?.number && pr.repo ? { number: pr.number, repo: pr.repo, prRepo: pr.prRepo ?? null } : null
  )
  useEffect(() => {
    const parsed = JSON.parse(target) as {
      number: number
      repo: { path: string; id: string }
      prRepo: PortfolioTrackPr['prRepo'] | null
    } | null
    if (!parsed) {
      return
    }
    let current = true
    void fetchPRComments(parsed.repo.path, parsed.number, {
      repoId: parsed.repo.id,
      prRepo: parsed.prRepo
    }).then((result) => {
      if (current) {
        setComments(result)
      }
    })
    return () => {
      current = false
    }
  }, [fetchPRComments, target])
  return comments.filter((comment) => Date.parse(comment.createdAt) > since)
}

// Team mode: the code review agent triages the team's PR comments and the QA agent the external
// QA feedback; the user asks for each round, and decides what goes back to development.
export function PortfolioTaskTriage({
  state,
  task,
  busy,
  onRequestTriage
}: {
  state: PortfolioState
  task: PortfolioTask
  busy: boolean
  onRequestTriage: (feedback: string) => Promise<boolean>
}): React.JSX.Element {
  const canAsk = task.status === 'review' || task.status === 'accepted'
  return task.stage === 'qa' ? (
    <QaFeedback
      state={state}
      task={task}
      busy={busy || !canAsk}
      onRequestTriage={onRequestTriage}
    />
  ) : (
    <PrReview state={state} task={task} busy={busy || !canAsk} onRequestTriage={onRequestTriage} />
  )
}

function PrReview({
  state,
  task,
  busy,
  onRequestTriage
}: {
  state: PortfolioState
  task: PortfolioTask
  busy: boolean
  onRequestTriage: (feedback: string) => Promise<boolean>
}): React.JSX.Element {
  // A reviewer's review runs on the teammate's PR; an author's PR is development's branch.
  const reviewer = portfolioTrackRole(state, task) === 'reviewer'
  const worktreeId = portfolioTrackTask(
    state,
    task,
    reviewer ? 'codeReview' : 'development'
  )?.attempts.at(-1)?.worktreeId
  const pr = usePortfolioPrLookup()(worktreeId ?? '')
  usePortfolioPrRefresh(worktreeId ? [worktreeId] : [])
  const refresh = useAppStore((s) => s.refreshGitHubForWorktree)
  const fresh = useNewPrComments(pr, portfolioSubmittedAt(task) ?? 0)
  // The user's own branch is a draft PR until the local code review has submitted; only then
  // does the user mark it ready for the team.
  const reviewed = task.status === 'review' || task.status === 'accepted'
  const readyForTeam =
    pr !== undefined && !['none', 'checking', 'draft', 'merged', 'closed'].includes(pr.status)
  return (
    <section
      aria-label={translate('portfolio.prSection', 'Pull request')}
      className="space-y-3 rounded-md border border-border p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">
          {pr?.number
            ? translate('portfolio.prNumber', 'Pull request #{{number}}', { number: pr.number })
            : translate('portfolio.prSection', 'Pull request')}
        </h3>
        {worktreeId && (
          <Button
            variant="ghost"
            size="xs"
            aria-label={translate('portfolio.prRefresh', 'Refresh PR status')}
            onClick={() => refresh(worktreeId)}
          >
            <RefreshCw aria-hidden="true" />
          </Button>
        )}
      </div>
      <p>
        {pr
          ? prStatusLabel(pr.status)
          : reviewer
            ? translate(
                'portfolio.prReviewerWorkspace',
                'Start a workspace on the teammate’s PR from Orca’s GitHub pull requests, then start the review in it.'
              )
            : translate('portfolio.prNoWorkspace', 'The development workspace is not available.')}
      </p>
      {reviewer && <NewCommits task={task} pr={pr} busy={busy} onRequestTriage={onRequestTriage} />}
      {!reviewer && pr?.status === 'none' && (
        <p className="text-xs text-muted-foreground">
          {translate(
            'portfolio.prDraftHint',
            'The development agent opens a draft PR once you confirm it on the development task; Workbench follows it from there.'
          )}
        </p>
      )}
      {!reviewer && reviewed && pr?.status === 'draft' && (
        <p className="text-xs text-muted-foreground">
          {translate(
            'portfolio.prMarkReady',
            'The local code review is submitted. Mark the PR ready for review on GitHub when you are satisfied.'
          )}
        </p>
      )}
      {!reviewer && !reviewed && readyForTeam && (
        <p className="text-xs text-destructive">
          {translate(
            'portfolio.prBeforeLocalReview',
            'This PR is open for the team’s review before the local code review finished. Convert it to a draft until the review is submitted.'
          )}
        </p>
      )}
      {!reviewer &&
        task.status === 'review' &&
        pr &&
        pr.status !== 'readyToMerge' &&
        pr.status !== 'merged' && (
          <p className="text-xs text-muted-foreground">
            {translate(
              'portfolio.prNotApproved',
              'The team has not approved the PR yet; accept this review once their feedback is settled.'
            )}
          </p>
        )}
      {pr?.url && (
        <Button variant="outline" size="sm" onClick={() => window.api.shell.openUrl(pr.url!)}>
          {translate('portfolio.prOpenGithub', 'Open on GitHub')}
        </Button>
      )}
      {pr?.number !== undefined && (
        <div className="space-y-2 border-t border-border pt-3">
          <p>
            {translate(
              'portfolio.prNewComments',
              'New PR comments since the last review: {{count}}',
              {
                count: fresh.length,
                defaultValue_one: 'New PR comments since the last review: {{count}}'
              }
            )}
          </p>
          <Button
            size="sm"
            disabled={busy || !fresh.length}
            onClick={() => void onRequestTriage(commentsText(fresh))}
          >
            {translate('portfolio.prTriage', 'Ask the reviewer to triage them')}
          </Button>
        </div>
      )}
    </section>
  )
}

// The author pushed after the user's last review: the next round reviews what changed.
function NewCommits({
  task,
  pr,
  busy,
  onRequestTriage
}: {
  task: PortfolioTask
  pr: PortfolioTrackPr | undefined
  busy: boolean
  onRequestTriage: (feedback: string) => Promise<boolean>
}): React.JSX.Element | null {
  const reviewed = portfolioSubmittedCommit(task)
  if (task.stage !== 'codeReview' || !reviewed || !pr?.headSha || pr.headSha.startsWith(reviewed)) {
    return null
  }
  const round = `The author pushed new commits since the review at ${reviewed.slice(0, 10)}; the PR is now at ${pr.headSha.slice(0, 10)}. Update this workspace to the PR's latest commit (fetch only; do not push), review what changed since then, and check whether your earlier findings were addressed.`
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <p className="font-medium">
        {translate('portfolio.trackNewCommits', 'New commits since your review')}
      </p>
      <Button size="sm" disabled={busy} onClick={() => void onRequestTriage(round)}>
        {translate('portfolio.reviewNewCommits', 'Review the new commits')}
      </Button>
    </div>
  )
}

function QaFeedback({
  state,
  task,
  busy,
  onRequestTriage
}: {
  state: PortfolioState
  task: PortfolioTask
  busy: boolean
  onRequestTriage: (feedback: string) => Promise<boolean>
}): React.JSX.Element {
  const link = state.workItems.find((item) => item.id === task.workItemId)?.qaFeedbackUrl
  const [note, setNote] = useState('')
  return (
    <section
      aria-label={translate('portfolio.qaFeedbackSection', 'External QA feedback')}
      className="space-y-3 rounded-md border border-border p-3"
    >
      <h3 className="font-medium">
        {translate('portfolio.qaFeedbackSection', 'External QA feedback')}
      </h3>
      {link ? (
        <>
          <Button variant="outline" size="sm" onClick={() => window.api.shell.openUrl(link)}>
            {translate('portfolio.qaFeedbackOpen', 'Open QA feedback')}
          </Button>
          <PortfolioField label={translate('portfolio.qaFeedbackNote', 'What is new (optional)')}>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              maxLength={MAX_FEEDBACK}
            />
          </PortfolioField>
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              const feedback = `${note.trim() || 'New external QA feedback.'}\n${link}`
              if (await onRequestTriage(feedback)) {
                setNote('')
              }
            }}
          >
            {translate('portfolio.qaTriage', 'Ask QA to triage the feedback')}
          </Button>
        </>
      ) : (
        <p className="text-muted-foreground">
          {translate(
            'portfolio.qaFeedbackMissing',
            'Add the QA feedback link (such as the Notion page) in the outcome’s Tickets, parity, and feature.'
          )}
        </p>
      )}
    </section>
  )
}
