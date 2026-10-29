import { z } from 'zod'
import { PortfolioCommand } from '../portfolio'

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
