import { folderWorkspaceRepoId } from '../../../../shared/folder-workspace-worktree'
import { parseWslUncPath } from '../../../../shared/wsl-paths'
import {
  PortfolioDiscover,
  PortfolioCancelDiscovery
} from '../../../../shared/rpc-contract/portfolio-params'
import {
  cancelPortfolioDiscovery,
  discoverPortfolioObjective
} from '../../../portfolio/portfolio-discovery'
import type { PortfolioSourceRoot } from '../../../portfolio/portfolio-source-context'
import { defineMethod, type RpcContext } from '../core'

function owner(context: RpcContext): string {
  if (context.pairedDeviceId) {
    return `device:${context.pairedDeviceId}`
  }
  if (context.caller?.kind === 'paired-device') {
    return `device:${context.caller.deviceId}`
  }
  if (context.caller?.kind === 'desktop') {
    return `desktop:${context.connectionId ?? 'local'}`
  }
  if (context.caller?.kind === 'local-cli') {
    return 'local-cli'
  }
  throw new Error('Project analysis requires an authenticated connection.')
}

function sourceRoots(ids: string[], context: RpcContext): PortfolioSourceRoot[] {
  const roots: PortfolioSourceRoot[] = []
  const repos = context.runtime.listVisibleRepos()
  const folders = context.runtime.listVisibleFolderWorkspaces()
  for (const id of new Set(ids)) {
    const repo = repos.find((entry) => entry.id === id)
    if (repo && !repo.connectionId && (!repo.executionHostId || repo.executionHostId === 'local')) {
      roots.push({ name: repo.displayName, path: repo.path })
      continue
    }
    const matches = folders.filter(
      (entry) =>
        folderWorkspaceRepoId(entry.projectGroupId) === id &&
        !entry.isArchived &&
        !entry.connectionId &&
        (!entry.executionHostId || entry.executionHostId === 'local')
    )
    if (!matches.length) {
      throw new Error(
        'A selected directory is unavailable on this computer. Import it locally or select another directory.'
      )
    }
    roots.push(...matches.map((entry) => ({ name: entry.name, path: entry.folderPath })))
  }
  const unique = [...new Map(roots.map((entry) => [entry.path, entry])).values()]
  if (unique.length > 10) {
    throw new Error('Choose up to 10 directories per analysis.')
  }
  if (unique.some((entry) => parseWslUncPath(entry.path))) {
    throw new Error(
      'Project analysis currently supports native local directories. WSL directories are not supported yet.'
    )
  }
  return unique
}

export const PORTFOLIO_DISCOVERY_METHODS = [
  defineMethod({
    name: 'portfolio.discover',
    permission: 'workspace',
    requires: ['accounts'],
    params: PortfolioDiscover,
    handler: (params, context) =>
      discoverPortfolioObjective(params, {
        owner: owner(context),
        roots: sourceRoots(params.repoIds, context),
        settings: context.runtime.getClientSettings(),
        environment: context.runtime.getCommitMessageAgentEnvironmentResolvers(),
        signal: context.signal
      })
  }),
  defineMethod({
    name: 'portfolio.cancelDiscovery',
    permission: 'workspace',
    params: PortfolioCancelDiscovery,
    handler: (params, context) => {
      cancelPortfolioDiscovery(owner(context), params.requestId)
      return { ok: true }
    }
  })
]
