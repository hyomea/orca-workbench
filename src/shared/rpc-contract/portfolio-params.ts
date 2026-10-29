import { z } from 'zod'
import { PortfolioCommand } from '../portfolio'
export { PortfolioIntake } from '../portfolio-intake'
export { PortfolioDiscover, PortfolioCancelDiscovery } from '../portfolio-discovery'

export const PortfolioRead = z.object({})
export const PortfolioMutate = z.object({
  revision: z.number().int().nonnegative(),
  command: PortfolioCommand
})
export const PortfolioLaunch = z.object({
  revision: z.number().int().nonnegative(),
  taskId: z.string().min(1),
  worktreeId: z.string().min(1)
})

export const PortfolioAttachDesign = z.object({
  revision: z.number().int().nonnegative(),
  workItemId: z.string().min(1),
  name: z.string().min(1).max(500),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  base64: z.string().min(1).max(6990508)
})
export const PortfolioReadDesign = z.object({ attachmentId: z.string().regex(/^[a-f0-9]{64}$/) })
export const PortfolioRemoveDesign = PortfolioReadDesign.extend({
  revision: z.number().int().nonnegative(),
  workItemId: z.string().min(1)
})
