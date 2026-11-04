import type { HandlerContext } from '../dispatch'
import type { PortfolioState } from '../../shared/portfolio'

export const LOCAL_ONLY = 'workbench commands; initiatives are stored on this computer.'

export async function read(ctx: HandlerContext): Promise<PortfolioState> {
  return (await ctx.client.call<PortfolioState>('portfolio.read', {})).result
}
