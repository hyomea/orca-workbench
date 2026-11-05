import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { PortfolioTask } from '../../../../shared/portfolio'
import { PortfolioField } from './portfolio-controls'
import { prStatusLabel, usePortfolioPrLookup, usePortfolioPrRefresh } from './portfolio-track-pr'

// Accepted development continues as the PR of its branch; review feedback goes back to the same
// development session, the way code review and QA findings do.
export function PortfolioTaskPr({
  task,
  busy,
  onReturnFeedback,
  onOpenWorkspace
}: {
  task: PortfolioTask
  busy: boolean
  onReturnFeedback: (note: string, rerunChecks: boolean) => Promise<boolean>
  onOpenWorkspace: (worktreeId: string) => void
}): React.JSX.Element | null {
  const worktreeId = task.attempts.at(-1)?.worktreeId
  const pr = usePortfolioPrLookup()(worktreeId ?? '')
  usePortfolioPrRefresh(worktreeId ? [worktreeId] : [])
  const refresh = useAppStore((s) => s.refreshGitHubForWorktree)
  const [feedback, setFeedback] = useState('')
  const [rerunChecks, setRerunChecks] = useState(false)
  if (!worktreeId || !pr) {
    return null
  }
  return (
    <section
      aria-label={translate('portfolio.prSection', 'Pull request')}
      className="space-y-3 rounded-md border border-border p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">
          {pr.number
            ? translate('portfolio.prNumber', 'Pull request #{{number}}', { number: pr.number })
            : translate('portfolio.prSection', 'Pull request')}
        </h3>
        <Button
          variant="ghost"
          size="xs"
          aria-label={translate('portfolio.prRefresh', 'Refresh PR status')}
          onClick={() => refresh(worktreeId)}
        >
          <RefreshCw aria-hidden="true" />
        </Button>
      </div>
      <p>{prStatusLabel(pr.status)}</p>
      {pr.status === 'none' && (
        <p className="text-xs text-muted-foreground">
          {translate(
            'portfolio.prOpenHint',
            'Push the branch and open the PR from its workspace when you are ready; Workbench follows it from there.'
          )}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => onOpenWorkspace(worktreeId)}>
          {translate('portfolio.openWorkspace', 'Open workspace')}
        </Button>
        {pr.url && (
          <Button variant="outline" size="sm" onClick={() => window.api.shell.openUrl(pr.url!)}>
            {translate('portfolio.prOpenGithub', 'Open on GitHub')}
          </Button>
        )}
      </div>
      {pr.status !== 'merged' && pr.status !== 'none' && (
        <div className="space-y-2 border-t border-border pt-3">
          <PortfolioField label={translate('portfolio.prFeedback', 'PR feedback to address')}>
            <Textarea
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              placeholder={translate(
                'portfolio.prFeedbackPlaceholder',
                'Paste the review comments development should address.'
              )}
              rows={3}
              maxLength={20000}
            />
          </PortfolioField>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={rerunChecks}
              onCheckedChange={(checked) => setRerunChecks(checked === true)}
              className="mt-0.5"
            />
            <span>
              {translate(
                'portfolio.prRerunChecks',
                'Run code review and QA again after the fix (for larger changes)'
              )}
            </span>
          </label>
          <Button
            size="sm"
            disabled={busy || !feedback.trim()}
            onClick={async () => {
              if (await onReturnFeedback(feedback, rerunChecks)) {
                setFeedback('')
              }
            }}
          >
            {translate('portfolio.prReturnFeedback', 'Send PR feedback to development')}
          </Button>
        </div>
      )}
    </section>
  )
}
