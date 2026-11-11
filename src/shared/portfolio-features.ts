import { z } from 'zod'
import { PortfolioDiscoveryConclusion } from './portfolio-outcome-discovery'
import { PortfolioDesignAttachments } from './portfolio-design'
import { PortfolioFeatureParity } from './portfolio-feature-parity'
import { PortfolioChecklistEntry, PortfolioChecklistItem } from './portfolio-checklist'

const Id = z.string().trim().min(1).max(4096)
const Name = z.string().trim().min(1).max(200)
const Text = z.string().trim().max(12000)
export const PortfolioWorkItemKind = z.enum([
  'initial',
  'bug',
  'improvement',
  'investigation',
  'engineering'
])
export const PortfolioWorkPlatform = z.enum(['ios', 'android', 'backend', 'shared'])
export type PortfolioWorkPlatform = z.infer<typeof PortfolioWorkPlatform>
// The user's part in a platform's work in a team initiative: building it (author, the default),
// reviewing and testing a teammate's PR (reviewer), or following someone else's work (tracking).
export const PortfolioTicketRole = z.enum(['author', 'reviewer', 'tracking'])
export type PortfolioTicketRole = z.infer<typeof PortfolioTicketRole>
// One ticket per platform when an outcome spans iOS, Android, and backend.
// A platform can be involved before its ticket exists, so only an unassigned reference must be set.
export const PortfolioTicket = z
  .object({
    platform: PortfolioWorkPlatform.optional(),
    reference: z.string().trim().max(2000),
    // Absent means author.
    role: PortfolioTicketRole.optional(),
    // The teammate's pull request, for a platform the user reviews or tracks.
    pr: z.string().trim().url().max(2000).optional()
  })
  .refine((ticket) => ticket.platform || ticket.reference, 'Name a platform or a reference.')
export type PortfolioTicket = z.infer<typeof PortfolioTicket>
// Earlier versions also set active, blocked, and review by hand; history keeps those entries.
export const PortfolioWorkItemStatus = z.enum([
  'planned',
  'active',
  'blocked',
  'review',
  'accepted'
])
// An outcome is open until the user signs it off; its tasks show how far the work has come.
export const PortfolioWorkItemSignOff = z.enum(['planned', 'accepted'])
const StoredWorkItemStatus = PortfolioWorkItemStatus.transform((status) =>
  status === 'accepted' ? status : 'planned'
)
export const PortfolioFeatureInput = z.object({ projectId: Id, name: Name, description: Text })
const PortfolioFeatureDetails = PortfolioFeatureInput.omit({ projectId: true })
// A work item is an outcome: what this piece of work should achieve. A feature is optional; an
// outcome that changes a product feature publishes its specification there when accepted.
export const PortfolioWorkItemInput = z.object({
  projectId: Id,
  featureId: Id.optional(),
  kind: PortfolioWorkItemKind,
  title: Name,
  description: Text,
  acceptanceCriteria: Text,
  designReferences: Text,
  tickets: z.array(PortfolioTicket).max(20),
  // Parity outcomes must behave the same on iOS and Android, proven by a shared test plan.
  parity: z.boolean()
})
export const PortfolioFeatureVersion = z.object({
  version: z.number().int().positive(),
  workItemId: Id,
  designAttachments: PortfolioDesignAttachments,
  description: Text,
  acceptanceCriteria: Text.min(1),
  designReferences: Text,
  sourceReference: z.string(),
  at: z.number(),
  note: Text.min(1)
})
export const PortfolioFeature = PortfolioFeatureInput.extend({
  id: Id,
  versions: z.array(PortfolioFeatureVersion),
  parity: PortfolioFeatureParity.optional()
})
const QaFeedbackUrl = z.string().trim().url().max(2000)
export const PortfolioWorkItem = PortfolioWorkItemInput.extend({
  designAttachments: PortfolioDesignAttachments,
  // Where external QA records its feedback (such as a Notion page), for team-mode QA to triage.
  qaFeedbackUrl: QaFeedbackUrl.optional(),
  // A discovery outcome's findings so far, and how it concluded.
  findings: Text.optional(),
  conclusion: PortfolioDiscoveryConclusion.optional(),
  // Absent on outcomes saved before checklists: their criteria text is read as items.
  checklist: z.array(PortfolioChecklistItem).max(100).optional(),
  id: Id,
  baseVersion: z.number().int().nonnegative(),
  status: StoredWorkItemStatus,
  history: z.array(
    z.object({ id: Id, at: z.number(), status: PortfolioWorkItemStatus, note: Text.min(1) })
  )
})
export type PortfolioFeature = z.infer<typeof PortfolioFeature>
export type PortfolioWorkItem = z.infer<typeof PortfolioWorkItem>
export type PortfolioWorkItemInput = z.infer<typeof PortfolioWorkItemInput>

export function portfolioTicketsText(tickets: readonly PortfolioTicket[]): string {
  return tickets
    .map((ticket) => {
      const role = ticket.role && ticket.role !== 'author' ? ` (user is ${ticket.role})` : ''
      const pr = ticket.pr ? ` PR ${ticket.pr}` : ''
      return ticket.platform
        ? `${ticket.platform}${role}: ${ticket.reference}${pr}`
        : ticket.reference
    })
    .join('\n')
}

// Schema 5 kept work items under a required feature with one free-text source reference.
const LegacyWorkItem = z
  .object({ featureId: Id, sourceReference: z.string(), kind: z.string(), id: Id })
  .passthrough()
export function migrateLegacyWorkItems(state: {
  features?: { id: string; projectId: string }[]
  workItems?: unknown[]
}): unknown[] {
  return (state.workItems ?? []).map((value) => {
    const { featureId, sourceReference, ...item } = LegacyWorkItem.parse(value)
    const projectId = state.features?.find((feature) => feature.id === featureId)?.projectId
    return {
      ...item,
      projectId,
      featureId,
      tickets: sourceReference.trim() ? [{ reference: sourceReference.trim() }] : [],
      // Before outcomes, every delivery except triage required iOS and Android evidence.
      parity: item.kind !== 'investigation'
    }
  })
}
export const PortfolioFeatureCommands = [
  z.object({ kind: z.literal('feature.create'), feature: PortfolioFeatureInput }),
  z.object({
    kind: z.literal('workItem.create'),
    workItem: PortfolioWorkItemInput,
    expectedBaseVersion: z.number().int().nonnegative().optional()
  }),
  z.object({
    kind: z.literal('workItem.update'),
    workItemId: Id,
    workItem: PortfolioWorkItemInput,
    expected: PortfolioWorkItemInput
  }),
  z.object({
    // Signs the outcome off (accepted) or reopens it (planned).
    kind: z.literal('workItem.transition'),
    workItemId: Id,
    status: PortfolioWorkItemSignOff,
    note: Text.min(1)
  }),
  z.object({
    kind: z.literal('workItem.scope'),
    workItemId: Id,
    tickets: z.array(PortfolioTicket).max(20),
    parity: z.boolean(),
    // Omitted keeps the feature link; null removes it; an id links the outcome to that feature.
    feature: Id.nullable().optional(),
    // Omitted keeps the external QA feedback link; null removes it.
    qaFeedbackUrl: QaFeedbackUrl.nullable().optional()
  }),
  // Criteria and decisions can change while the work runs; the agents read the current list.
  z.object({
    kind: z.literal('workItem.checklist'),
    workItemId: Id,
    items: z.array(PortfolioChecklistEntry).max(100)
  }),
  // featureId links an outcome that has no feature yet to the one its specification belongs to.
  z.object({
    kind: z.literal('feature.publish'),
    workItemId: Id,
    note: Text.min(1),
    featureId: Id.optional()
  }),
  z.object({
    kind: z.literal('feature.update'),
    featureId: Id,
    feature: PortfolioFeatureDetails,
    expected: PortfolioFeatureDetails
  }),
  z.object({ kind: z.literal('feature.delete'), featureId: Id }),
  // Records what was found when the feature was checked on both platforms.
  z.object({ kind: z.literal('feature.parity'), featureId: Id, parity: PortfolioFeatureParity }),
  z.object({ kind: z.literal('task.linkWorkItem'), taskId: Id, workItemId: Id.optional() })
] as const
