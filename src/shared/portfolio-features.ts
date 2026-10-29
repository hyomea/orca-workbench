import { z } from 'zod'

const Id = z.string().trim().min(1).max(4096)
const Name = z.string().trim().min(1).max(200)
const Text = z.string().trim().max(12000)
export const PortfolioWorkItemKind = z.enum(['initial', 'bug', 'improvement', 'investigation'])
export const PortfolioWorkItemStatus = z.enum([
  'planned',
  'active',
  'blocked',
  'review',
  'accepted'
])
export const PortfolioFeatureInput = z.object({ projectId: Id, name: Name, description: Text })
export const PortfolioWorkItemInput = z.object({
  featureId: Id,
  kind: PortfolioWorkItemKind,
  title: Name,
  description: Text,
  acceptanceCriteria: Text,
  designReferences: Text,
  sourceReference: z.string().trim().max(2000)
})
export const PortfolioFeatureVersion = z.object({
  version: z.number().int().positive(),
  workItemId: Id,
  description: Text,
  acceptanceCriteria: Text.min(1),
  designReferences: Text,
  sourceReference: z.string(),
  at: z.number(),
  note: Text.min(1)
})
export const PortfolioFeature = PortfolioFeatureInput.extend({
  id: Id,
  versions: z.array(PortfolioFeatureVersion)
})
export const PortfolioWorkItem = PortfolioWorkItemInput.extend({
  id: Id,
  baseVersion: z.number().int().nonnegative(),
  status: PortfolioWorkItemStatus,
  history: z.array(
    z.object({ id: Id, at: z.number(), status: PortfolioWorkItemStatus, note: Text.min(1) })
  )
})
export type PortfolioFeature = z.infer<typeof PortfolioFeature>
export type PortfolioWorkItem = z.infer<typeof PortfolioWorkItem>
export type PortfolioWorkItemInput = z.infer<typeof PortfolioWorkItemInput>
export const PortfolioFeatureCommands = [
  z.object({ kind: z.literal('feature.create'), feature: PortfolioFeatureInput }),
  z.object({ kind: z.literal('workItem.create'), workItem: PortfolioWorkItemInput }),
  z.object({
    kind: z.literal('workItem.update'),
    workItemId: Id,
    workItem: PortfolioWorkItemInput,
    expected: PortfolioWorkItemInput
  }),
  z.object({
    kind: z.literal('workItem.transition'),
    workItemId: Id,
    status: PortfolioWorkItemStatus,
    note: Text.min(1)
  }),
  z.object({ kind: z.literal('feature.publish'), workItemId: Id, note: Text.min(1) }),
  z.object({ kind: z.literal('task.linkWorkItem'), taskId: Id, workItemId: Id.optional() })
] as const
