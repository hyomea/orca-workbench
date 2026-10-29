import { z } from 'zod'
import type { PortfolioState } from './portfolio'

export const MAX_PORTFOLIO_IMAGE_BYTES = 5 * 1024 * 1024
export const PortfolioDesignAttachment = z.object({
  id: z.string().regex(/^[a-f0-9]{64}$/),
  name: z.string().min(1).max(200),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  bytes: z.number().int().positive().max(MAX_PORTFOLIO_IMAGE_BYTES)
})
export const PortfolioDesignAttachments = z.array(PortfolioDesignAttachment).max(12).optional()
export type PortfolioDesignAttachment = z.infer<typeof PortfolioDesignAttachment>

export function canEditPortfolioContext(state: PortfolioState, workItemId: string): boolean {
  const item = state.workItems.find((entry) => entry.id === workItemId)
  return (
    !!item &&
    item.status === 'planned' &&
    !state.features.some((feature) => feature.versions.some((v) => v.workItemId === item.id)) &&
    !state.verification.some((entry) => entry.workItemId === item.id) &&
    state.tasks
      .filter((task) => task.workItemId === item.id)
      .every(
        (task) =>
          task.status === 'accepted' &&
          (!task.attempts.length || task.attempts.at(-1)?.state === 'closed')
      )
  )
}

export function portfolioDesignAttachments(state: PortfolioState): PortfolioDesignAttachment[] {
  return [
    ...state.workItems.flatMap((item) => item.designAttachments ?? []),
    ...state.features.flatMap((feature) =>
      feature.versions.flatMap((v) => v.designAttachments ?? [])
    ),
    ...state.verification.flatMap((entry) =>
      entry.plans.flatMap((plan) => plan.designAttachments ?? [])
    )
  ]
}
