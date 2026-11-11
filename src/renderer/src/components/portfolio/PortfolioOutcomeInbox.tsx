import { useState } from 'react'
import { Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import type { PortfolioCommand, PortfolioState } from '../../../../shared/portfolio'
import {
  portfolioChecklist,
  type PortfolioChecklistProposal
} from '../../../../shared/portfolio-checklist'
import type { PortfolioWorkItem } from '../../../../shared/portfolio-features'
import { PortfolioRelayNotice } from './PortfolioChecklist'
import { saveChecklistChange } from './portfolio-checklist-relay'
import { portfolioOutcomeNoteDrafts } from '../../../../shared/portfolio-outcome-reports'

function proposer(state: PortfolioState, proposal: { taskId?: string }): string {
  const task = state.tasks.find((entry) => entry.id === proposal.taskId)
  if (!task) {
    return translate('portfolio.proposalByAgent', 'An agent')
  }
  const role = state.roles.find((entry) => entry.id === task.roleId)
  return `${role?.agentName ?? role?.name ?? ''} · ${task.title}`.replace(/^ · /, '')
}

function Proposal({
  state,
  item,
  proposal,
  busy,
  onDecide
}: {
  state: PortfolioState
  item: PortfolioWorkItem
  proposal: PortfolioChecklistProposal
  busy: boolean
  onDecide: (command: PortfolioCommand) => void
}): React.JSX.Element {
  const from = proposer(state, proposal)
  const [text, setText] = useState(proposal.text)
  const [note, setNote] = useState(proposal.reason ? `${from}: ${proposal.reason}` : from)
  const current = portfolioChecklist(item).find((entry) => entry.id === proposal.itemId)
  return (
    <li className="space-y-2 rounded-md bg-muted/40 p-2">
      <p className="text-xs text-muted-foreground">
        {proposal.kind === 'decision'
          ? translate('portfolio.proposedDecision', 'Decision proposed by {{from}}', { from })
          : translate('portfolio.proposedCriterion', 'Criterion proposed by {{from}}', { from })}
      </p>
      {current && (
        <p className="text-xs">
          {translate('portfolio.proposalReplaces', 'Replaces: {{text}}', { text: current.text })}
        </p>
      )}
      <Input
        aria-label={translate('portfolio.checklistText', 'Checklist item')}
        value={text}
        maxLength={2000}
        onChange={(event) => setText(event.target.value)}
      />
      <Input
        aria-label={translate('portfolio.checklistNote', 'Where it came from')}
        value={note}
        maxLength={2000}
        onChange={(event) => setNote(event.target.value)}
        className="text-xs"
      />
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() =>
            onDecide({
              kind: 'workItem.dismissProposal',
              workItemId: item.id,
              proposalId: proposal.id
            })
          }
        >
          {translate('portfolio.dismissProposal', 'Dismiss proposal')}
        </Button>
        <Button
          size="sm"
          disabled={busy || !text.trim()}
          onClick={() =>
            onDecide({
              kind: 'workItem.acceptProposal',
              workItemId: item.id,
              proposalId: proposal.id,
              item: { kind: proposal.kind, text: text.trim(), note: note.trim() || undefined }
            })
          }
        >
          {current
            ? translate('portfolio.acceptChange', 'Accept change')
            : translate('portfolio.addToChecklist', 'Add to checklist')}
        </Button>
      </div>
    </li>
  )
}

// Agents' proposed checklist changes. Accepting one changes the checklist and tells the
// outcome's open sessions; nothing reaches the checklist without the user.
export function PortfolioOutcomeInbox({
  state,
  item,
  busy,
  onSave,
  onReviewNote
}: {
  state: PortfolioState
  item: PortfolioWorkItem
  busy: boolean
  onSave: (command: PortfolioCommand) => Promise<boolean>
  onReviewNote: (draftId: string) => void
}): React.JSX.Element | null {
  const [notice, setNotice] = useState('')
  const proposals = item.proposals ?? []
  const reports = item.reports ?? []
  const notes = portfolioOutcomeNoteDrafts(state, item.id)
  const count = proposals.length + reports.length + notes.length
  if (!count && !notice) {
    return null
  }
  const decide = async (command: PortfolioCommand): Promise<void> => {
    const result = await saveChecklistChange(state, item.id, command, onSave)
    if (result !== false) {
      setNotice(result)
    }
  }
  return (
    <section
      aria-label={translate('portfolio.outcomeInbox', 'Inbox')}
      className="space-y-3 rounded-md border border-border p-3"
    >
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <Inbox className="size-4 text-muted-foreground" aria-hidden="true" />
        {translate('portfolio.outcomeInboxCount', 'Inbox · {{count}} to review', {
          count,
          defaultValue_one: 'Inbox · {{count}} to review'
        })}
      </h3>
      <PortfolioRelayNotice notice={notice} />
      {reports.length > 0 && (
        <ul
          aria-label={translate('portfolio.agentQuestions', 'Questions from agents')}
          className="space-y-2"
        >
          {reports.map((report) => (
            <li key={report.id} className="space-y-1.5 rounded-md bg-muted/40 p-2">
              <p className="text-xs text-muted-foreground">
                {translate('portfolio.questionFrom', 'Question from {{from}}', {
                  from: proposer(state, report)
                })}
              </p>
              <p className="whitespace-pre-wrap break-words text-sm">{report.body}</p>
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void onSave({
                      kind: 'workItem.resolveReport',
                      workItemId: item.id,
                      reportId: report.id
                    })
                  }
                >
                  {translate('portfolio.resolveQuestion', 'Mark answered')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {notes.length > 0 && (
        <ul
          aria-label={translate('portfolio.inboxNoteProposals', 'Note proposals')}
          className="space-y-2"
        >
          {notes.map((draft) => (
            <li
              key={draft.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 p-2"
            >
              <span className="min-w-0 space-y-0.5">
                <span className="block text-xs text-muted-foreground">
                  {draft.noteId
                    ? translate('portfolio.noteChangeFrom', 'Note change proposed by {{from}}', {
                        from: proposer(state, draft)
                      })
                    : translate('portfolio.newNoteFrom', 'New note proposed by {{from}}', {
                        from: proposer(state, draft)
                      })}
                </span>
                <span className="block break-words text-sm">{draft.title}</span>
                {draft.reason && (
                  <span className="block break-words text-xs text-muted-foreground">
                    {draft.reason}
                  </span>
                )}
              </span>
              <Button variant="outline" size="sm" onClick={() => onReviewNote(draft.id)}>
                {translate('portfolio.reviewNote', 'Review note')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {proposals.length > 0 && (
        <ul className="space-y-2">
          {proposals.map((proposal) => (
            <Proposal
              key={proposal.id}
              state={state}
              item={item}
              proposal={proposal}
              busy={busy}
              onDecide={(command) => void decide(command)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
