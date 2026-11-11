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

function proposer(state: PortfolioState, proposal: PortfolioChecklistProposal): string {
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
  onSave
}: {
  state: PortfolioState
  item: PortfolioWorkItem
  busy: boolean
  onSave: (command: PortfolioCommand) => Promise<boolean>
}): React.JSX.Element | null {
  const [notice, setNotice] = useState('')
  const proposals = item.proposals ?? []
  if (!proposals.length && !notice) {
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
        {translate('portfolio.outcomeInboxCount', 'Inbox · {{count}} proposed changes', {
          count: proposals.length,
          defaultValue_one: 'Inbox · {{count}} proposed change'
        })}
      </h3>
      <PortfolioRelayNotice notice={notice} />
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
