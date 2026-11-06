import { z } from 'zod'
import type { PortfolioCommand, PortfolioState } from './portfolio'

const Id = z.string().trim().min(1).max(4096)
const Text = z.string().trim().min(1).max(12000)

// A discovery outcome is worked out with the steward and the user, without code. It ends as work
// on the same outcome, a ticket for later, or an initiative note for later.
export const PortfolioDiscoveryConclusion = z.object({
  outcome: z.enum(['work', 'ticket', 'note']),
  // The ticket key or link, or the note id.
  reference: z.string().trim().max(2000).optional(),
  at: z.number()
})
export type PortfolioDiscoveryConclusion = z.infer<typeof PortfolioDiscoveryConclusion>

export const PortfolioDiscoveryCommands = [
  z.object({ kind: z.literal('workItem.findings'), workItemId: Id, findings: Text }),
  z.object({
    kind: z.literal('workItem.conclude'),
    workItemId: Id,
    conclusion: z.discriminatedUnion('outcome', [
      z.object({
        outcome: z.literal('work'),
        workKind: z.enum(['initial', 'bug', 'improvement', 'engineering'])
      }),
      z.object({ outcome: z.literal('ticket'), reference: Text.max(2000) }),
      z.object({ outcome: z.literal('note'), noteId: Id })
    ]),
    note: Text
  })
] as const

export function applyPortfolioDiscoveryCommand(
  state: PortfolioState,
  command: PortfolioCommand,
  now: number
): boolean {
  if (command.kind !== 'workItem.findings' && command.kind !== 'workItem.conclude') {
    return false
  }
  const item = state.workItems.find((entry) => entry.id === command.workItemId)
  if (!item) {
    throw new Error('Outcome no longer exists.')
  }
  if (item.kind !== 'investigation' || item.conclusion) {
    throw new Error('Only an open discovery outcome takes findings or a conclusion.')
  }
  const event = (note: string) =>
    item.history.push({
      id: `${item.id}:${item.history.length}`,
      at: now,
      status: item.status,
      note
    })
  if (command.kind === 'workItem.findings') {
    item.findings = command.findings
    event('Discovery findings updated')
    return true
  }
  const { conclusion } = command
  if (conclusion.outcome === 'work') {
    // The same outcome continues as planned work, so it needs what any planned work needs.
    if (!item.acceptanceCriteria.trim()) {
      throw new Error('Write the acceptance criteria before turning the discovery into work.')
    }
    item.kind = conclusion.workKind
    item.conclusion = { outcome: 'work', at: now }
    event(`Discovery concluded as work: ${command.note}`)
    return true
  }
  if (
    conclusion.outcome === 'note' &&
    !state.notes.some((note) => note.id === conclusion.noteId && note.projectId === item.projectId)
  ) {
    throw new Error('Choose a note in this initiative.')
  }
  // Nothing more happens on this outcome; the ticket or note carries it forward.
  item.status = 'accepted'
  item.conclusion = {
    outcome: conclusion.outcome,
    reference: conclusion.outcome === 'note' ? conclusion.noteId : conclusion.reference,
    at: now
  }
  event(`Discovery concluded as a ${conclusion.outcome} for later: ${command.note}`)
  return true
}
