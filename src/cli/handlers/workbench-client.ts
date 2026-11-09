import { isAbsolute, relative, resolve } from 'node:path'
import type { HandlerContext } from '../dispatch'
import { getOptionalStringFlag } from '../flags'
import { RuntimeClientError } from '../runtime-client'
import type { PortfolioState, PortfolioTask } from '../../shared/portfolio'
import type { PortfolioWorkbenchSummary } from '../../shared/rpc-contract/portfolio-params'

export const LOCAL_ONLY = 'workbench commands; initiatives are stored on this computer.'

export type WorkbenchScope = { workbenchId: string }

export async function workbenches(ctx: HandlerContext): Promise<PortfolioWorkbenchSummary[]> {
  return (await ctx.client.call<PortfolioWorkbenchSummary[]>('portfolio.workbenches', {})).result
}

function inside(path: string, folder: string): boolean {
  const rest = relative(folder, path)
  return rest === '' || (!rest.startsWith('..') && !isAbsolute(rest))
}

function choices(list: readonly PortfolioWorkbenchSummary[]): string {
  return list.map((entry) => `${entry.name} (${entry.id})`).join(', ')
}

// --workbench, else the workbench whose coordinator runs here, else the only one there is.
export async function workbenchScope(ctx: HandlerContext): Promise<WorkbenchScope> {
  const list = await workbenches(ctx)
  const requested = getOptionalStringFlag(ctx.flags, 'workbench')
  if (requested) {
    if (!list.some((entry) => entry.id === requested)) {
      throw new RuntimeClientError(
        'invalid_argument',
        `No workbench has id ${requested}. Workbenches: ${choices(list)}.`
      )
    }
    return { workbenchId: requested }
  }
  const here = list.find((entry) => inside(resolve(ctx.cwd), entry.stewardPath))
  if (here || list.length === 1) {
    return { workbenchId: (here ?? list[0]).id }
  }
  throw new RuntimeClientError(
    'invalid_argument',
    `Several workbenches exist; pass --workbench <id>. Workbenches: ${choices(list)}.`
  )
}

export async function read(ctx: HandlerContext, scope: WorkbenchScope): Promise<PortfolioState> {
  return (await ctx.client.call<PortfolioState>('portfolio.read', scope)).result
}

// A task agent rarely knows its workbench: use the one holding a matching task.
export async function readTaskWorkbench(
  ctx: HandlerContext,
  matches: (task: PortfolioTask) => boolean
): Promise<{ scope: WorkbenchScope; state: PortfolioState }> {
  if (!getOptionalStringFlag(ctx.flags, 'workbench')) {
    const found: { scope: WorkbenchScope; state: PortfolioState }[] = []
    for (const entry of await workbenches(ctx)) {
      const scope = { workbenchId: entry.id }
      const state = await read(ctx, scope)
      if (state.tasks.some(matches)) {
        found.push({ scope, state })
      }
    }
    if (found.length === 1) {
      return found[0]
    }
  }
  // None or several: the caller's own lookup then reports what is missing or ambiguous.
  const scope = await workbenchScope(ctx)
  return { scope, state: await read(ctx, scope) }
}
