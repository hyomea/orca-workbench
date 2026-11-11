import { z } from 'zod'
import type { PortfolioState } from './portfolio'
import {
  portfolioChecklist,
  portfolioChecklistFromEntries,
  portfolioCriteriaText,
  PortfolioChecklistEntry,
  PortfolioChecklistProposalInput,
  type PortfolioChecklistItem
} from './portfolio-checklist'
import type { PortfolioWorkItem } from './portfolio-features'

const Id = z.string().trim().min(1).max(4096)
const MAX_PROPOSALS = 50

// Criteria and decisions can change while the work runs; the agents read the current list.
// Agents propose changes into the outcome's inbox; only the user's acceptance applies one.
export const PortfolioChecklistCommands = [
  z.object({
    kind: z.literal('workItem.checklist'),
    workItemId: Id,
    items: z.array(PortfolioChecklistEntry).max(100)
  }),
  z.object({
    kind: z.literal('workItem.proposeChecklist'),
    workItemId: Id,
    proposal: PortfolioChecklistProposalInput
  }),
  z.object({
    // The user may reword the proposal before accepting it.
    kind: z.literal('workItem.acceptProposal'),
    workItemId: Id,
    proposalId: Id,
    item: PortfolioChecklistEntry.omit({ id: true })
  }),
  z.object({ kind: z.literal('workItem.dismissProposal'), workItemId: Id, proposalId: Id })
] as const
type ChecklistCommand = z.infer<(typeof PortfolioChecklistCommands)[number]>

function assertOpen(state: PortfolioState, item: PortfolioWorkItem): void {
  const published = state.features
    .find((feature) => feature.id === item.featureId)
    ?.versions.some((version) => version.workItemId === item.id)
  if (item.status === 'accepted' || published) {
    throw new Error('Reopen the outcome before changing its checklist.')
  }
}

function write(
  item: PortfolioWorkItem,
  checklist: PortfolioChecklistItem[],
  now: number,
  note: string
) {
  item.checklist = checklist
  item.acceptanceCriteria = portfolioCriteriaText(checklist)
  item.history.push({ id: `${item.id}:${item.history.length}`, at: now, status: item.status, note })
}

function withoutProposal(item: PortfolioWorkItem, proposalId: string) {
  const proposal = item.proposals?.find((entry) => entry.id === proposalId)
  if (!proposal) {
    throw new Error('This proposal was already handled. Refresh the initiative.')
  }
  const rest = (item.proposals ?? []).filter((entry) => entry.id !== proposalId)
  if (rest.length) {
    item.proposals = rest
  } else {
    delete item.proposals
  }
  return proposal
}

export function applyPortfolioChecklistCommand(
  state: PortfolioState,
  command: { kind: string },
  id: string,
  now: number
): boolean {
  if (!PortfolioChecklistCommands.some((schema) => schema.shape.kind.value === command.kind)) {
    return false
  }
  const typed = command as ChecklistCommand
  const item = state.workItems.find((entry) => entry.id === typed.workItemId)
  if (!item) {
    throw new Error('Outcome no longer exists.')
  }
  switch (typed.kind) {
    case 'workItem.checklist':
      assertOpen(state, item)
      write(item, portfolioChecklistFromEntries(item, typed.items, now), now, 'Checklist updated')
      return true
    case 'workItem.proposeChecklist': {
      assertOpen(state, item)
      const { proposal } = typed
      if (
        proposal.taskId &&
        !state.tasks.some((task) => task.id === proposal.taskId && task.workItemId === item.id)
      ) {
        throw new Error('The task does not belong to this outcome.')
      }
      if (
        proposal.itemId &&
        !portfolioChecklist(item).some((entry) => entry.id === proposal.itemId)
      ) {
        throw new Error('The checklist item to change does not exist. Read the outcome again.')
      }
      if ((item.proposals?.length ?? 0) >= MAX_PROPOSALS) {
        throw new Error(
          'This outcome has too many pending proposals. Ask the user to review them first.'
        )
      }
      item.proposals = [...(item.proposals ?? []), { ...proposal, id, at: now }]
      return true
    }
    case 'workItem.acceptProposal': {
      assertOpen(state, item)
      const proposal = withoutProposal(item, typed.proposalId)
      const entries: PortfolioChecklistEntry[] = portfolioChecklist(item).map(
        ({ id: itemId, kind, text, note }) => ({ id: itemId, kind, text, note })
      )
      // A proposal whose item was removed meanwhile adds the item again.
      const index = entries.findIndex((entry) => entry.id === proposal.itemId)
      if (index !== -1) {
        entries[index] = { ...typed.item, id: entries[index].id }
      } else {
        entries.push(typed.item)
      }
      const task = state.tasks.find((entry) => entry.id === proposal.taskId)
      write(
        item,
        portfolioChecklistFromEntries(item, entries, now),
        now,
        `Checklist updated: accepted a proposal${task ? ` from ${task.title}` : ''}`
      )
      return true
    }
    case 'workItem.dismissProposal':
      withoutProposal(item, typed.proposalId)
      return true
  }
}
