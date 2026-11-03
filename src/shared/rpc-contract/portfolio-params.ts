import { z } from 'zod'
import { PortfolioCommand } from '../portfolio'
import { PortfolioNoteDraftInput } from '../portfolio-notes'
export { PortfolioIntake } from '../portfolio-intake'
export { PortfolioBatch } from '../portfolio-batch'
export { PortfolioDiscover, PortfolioCancelDiscovery } from '../portfolio-discovery'

export const PortfolioRead = z.object({})
export const PortfolioPrepareSteward = z.object({})
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

export const PortfolioExportNotes = z.object({
  projectId: z.string().min(1),
  directory: z.string().min(1).max(4096)
})
export const PortfolioSetPersonalNotesFolder = z.object({ folder: z.string().min(1).max(4096) })
export const PortfolioIndexPersonalNotes = z.object({})
export const PortfolioPersonalNotes = z.object({ repo: z.string().min(1).max(200).optional() })
export const PortfolioProposeNote = z.object({ draft: PortfolioNoteDraftInput })
