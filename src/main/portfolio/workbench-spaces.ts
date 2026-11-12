import { randomUUID } from 'node:crypto'
import { readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { applyPortfolioCommand } from '../../shared/portfolio'
import { PORTFOLIO_OUTCOME_COORDINATOR } from '../../shared/portfolio-roles'
import {
  DEFAULT_WORKBENCH_ID,
  WorkbenchId,
  type PortfolioWorkbenchSummary
} from '../../shared/rpc-contract/portfolio-params'
import { PortfolioStore } from './portfolio-store'
import { portfolioStewardDirectory } from './portfolio-steward'

function workbenchRoot(userData: string): string {
  return join(userData, 'workbench')
}

// The first workbench keeps the original location; later ones each get a folder under spaces/, so
// their data, design images, and coordinator folder stay apart.
export function workbenchStore(userData: string, id = DEFAULT_WORKBENCH_ID): PortfolioStore {
  const root = workbenchRoot(userData)
  return new PortfolioStore(
    id === DEFAULT_WORKBENCH_ID
      ? join(root, 'portfolio.json')
      : join(root, 'spaces', id, 'portfolio.json'),
    root
  )
}

async function workbenchIds(userData: string): Promise<string[]> {
  const spaces = join(workbenchRoot(userData), 'spaces')
  const entries = await readdir(spaces, { withFileTypes: true }).catch((error: unknown) => {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return []
    }
    throw error
  })
  const ids: string[] = []
  for (const entry of entries) {
    if (
      entry.isDirectory() &&
      (await stat(join(spaces, entry.name, 'portfolio.json')).catch(() => null))
    ) {
      ids.push(entry.name)
    }
  }
  return [DEFAULT_WORKBENCH_ID, ...ids]
}

// The first workbench always exists, even before anything is saved; the rest follow by name.
export async function listWorkbenches(userData: string): Promise<PortfolioWorkbenchSummary[]> {
  const summaries = await Promise.all(
    (await workbenchIds(userData)).map(async (id) => {
      const store = workbenchStore(userData, id)
      return {
        id,
        name: (await store.read()).organization,
        stewardPath: portfolioStewardDirectory(store)
      }
    })
  )
  const [first, ...rest] = summaries
  return [first, ...rest.sort((a, b) => a.name.localeCompare(b.name))]
}

export async function createWorkbench(
  userData: string,
  name: string
): Promise<PortfolioWorkbenchSummary> {
  const id = randomUUID()
  const store = workbenchStore(userData, id)
  await store.update(0, (state) => {
    applyPortfolioCommand(state, { kind: 'organization.rename', name }, randomUUID(), Date.now())
    applyPortfolioCommand(
      state,
      { kind: 'role.create', role: PORTFOLIO_OUTCOME_COORDINATOR },
      randomUUID(),
      Date.now()
    )
  })
  return { id, name, stewardPath: portfolioStewardDirectory(store) }
}

export async function removeWorkbench(userData: string, id: string): Promise<void> {
  WorkbenchId.parse(id)
  const root = workbenchRoot(userData)
  if (id === DEFAULT_WORKBENCH_ID) {
    const entries = await readdir(root).catch((error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return []
      }
      throw error
    })
    for (const entry of entries) {
      if (
        entry === 'portfolio.json' ||
        /^portfolio\.json\.v\d+\.bak$/.test(entry) ||
        ['steward', 'coordinators', 'design-attachments', 'note-files'].includes(entry)
      ) {
        await rm(join(root, entry), { recursive: true, force: true })
      }
    }
    return
  }
  const directory = join(root, 'spaces', id)
  const exists = await stat(join(directory, 'portfolio.json')).then(
    () => true,
    (error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return false
      }
      throw error
    }
  )
  if (!exists) {
    throw new Error('Workbench no longer exists. Refresh the list and try again.')
  }
  await rm(directory, { recursive: true })
}
