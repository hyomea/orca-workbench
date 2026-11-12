import { z } from 'zod'
import { PortfolioCommand } from '../portfolio'
import { PortfolioNoteDraftInput } from '../portfolio-notes'
import { PortfolioChecklistProposalInput } from '../portfolio-checklist'
import { PortfolioOutcomeReportInput } from '../portfolio-outcome-reports'
export { PortfolioIntake } from '../portfolio-intake'
import { PortfolioBatch } from '../portfolio-batch'
export { PortfolioBatch }
export { PortfolioDiscover, PortfolioCancelDiscovery } from '../portfolio-discovery'

// Each workbench keeps its own initiatives, roles, and coordinator. Without an id, the first one.
export const DEFAULT_WORKBENCH_ID = 'default'
export const WorkbenchId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/)
const InWorkbench = z.object({ workbenchId: WorkbenchId.optional() })
export const PortfolioWorkbenches = z.object({})
export const PortfolioCreateWorkbench = z.object({ name: z.string().trim().min(1).max(200) })
export const PortfolioRemoveWorkbench = z.object({ workbenchId: WorkbenchId })
export const PortfolioExportWorkbench = z.object({ workbenchId: WorkbenchId })
export const PortfolioImportWorkbench = z.object({})
export type PortfolioWorkbenchSummary = { id: string; name: string; stewardPath: string }

export const PortfolioRead = InWorkbench
export const PortfolioPrepareSteward = InWorkbench
export const PortfolioMutate = InWorkbench.extend({
  revision: z.number().int().nonnegative(),
  command: PortfolioCommand
})
export const PortfolioBatchParams = InWorkbench.extend(PortfolioBatch.shape)
export const PortfolioLaunch = InWorkbench.extend({
  revision: z.number().int().nonnegative(),
  taskId: z.string().min(1),
  worktreeId: z.string().min(1)
})

export const PortfolioAttachDesign = InWorkbench.extend({
  revision: z.number().int().nonnegative(),
  workItemId: z.string().min(1),
  name: z.string().min(1).max(500),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  base64: z.string().min(1).max(6990508)
})
export const PortfolioReadDesign = InWorkbench.extend({
  attachmentId: z.string().regex(/^[a-f0-9]{64}$/)
})
export const PortfolioRemoveDesign = PortfolioReadDesign.extend({
  revision: z.number().int().nonnegative(),
  workItemId: z.string().min(1)
})

export const PortfolioExportNotes = InWorkbench.extend({
  projectId: z.string().min(1),
  directory: z.string().min(1).max(4096)
})
export const PortfolioSetPersonalNotesFolder = z.object({ folder: z.string().min(1).max(4096) })
export const PortfolioIndexPersonalNotes = z.object({})
export const PortfolioPersonalNotes = z.object({ repo: z.string().min(1).max(200).optional() })
export const PortfolioProposeNote = InWorkbench.extend({ draft: PortfolioNoteDraftInput })
export const PortfolioProposeChecklist = InWorkbench.extend({
  workItemId: z.string().min(1),
  proposal: PortfolioChecklistProposalInput
})
export const PortfolioPrepareCoordinator = InWorkbench.extend({ workItemId: z.string().min(1) })
export const PortfolioReportOutcome = InWorkbench.extend({
  workItemId: z.string().min(1),
  report: PortfolioOutcomeReportInput
})
