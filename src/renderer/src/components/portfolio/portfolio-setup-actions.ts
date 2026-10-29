import { createBrowserUuid } from '@/lib/browser-uuid'
import { useAppStore } from '@/store'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { translate } from '@/i18n/i18n'
import { PortfolioDiscoveryResult } from '../../../../shared/portfolio-discovery'
import type {
  PortfolioImportCandidate,
  PortfolioSetupActions
} from './portfolio-project-setup-types'

export const portfolioSetupActions: PortfolioSetupActions = {
  async pickSources() {
    const paths = await window.api.repos.pickFolders()
    const candidates: PortfolioImportCandidate[] = []
    for (const path of paths) {
      const scan = await useAppStore.getState().scanNestedRepos(path, undefined, {
        scanId: createBrowserUuid(),
        runtimeEnvironmentId: null
      })
      if (!scan) {
        throw new Error(
          translate(
            'portfolio.directoryScanFailed',
            'Could not inspect the selected directory. Try importing it again.'
          )
        )
      }
      const name = path.split(/[\\/]/).findLast(Boolean) ?? path
      candidates.push({ path, name, kind: scan.selectedPathKind === 'git_repo' ? 'git' : 'folder' })
      candidates.push(
        ...scan.repos.map((repo) => ({
          path: repo.path,
          name: repo.displayName,
          kind: 'git' as const
        }))
      )
    }
    return [...new Map(candidates.map((entry) => [entry.path, entry])).values()]
  },
  async importSource(source) {
    const repo = await useAppStore
      .getState()
      .addRepoPath(source.path, source.kind, { runtimeEnvironmentId: null })
    if (!repo) {
      throw new Error(
        translate(
          'portfolio.directoryImportFailed',
          'Could not import this directory. Earlier imports are still available.'
        )
      )
    }
    await useAppStore.getState().fetchWorktrees(repo.id, { executionHostId: 'local' })
    return { id: repo.id, name: repo.displayName }
  },
  async discover(request) {
    return PortfolioDiscoveryResult.parse(
      await callRuntimeRpc({ kind: 'local' }, 'portfolio.discover', request)
    )
  },
  async cancelDiscovery(requestId) {
    await callRuntimeRpc({ kind: 'local' }, 'portfolio.cancelDiscovery', { requestId })
  }
}
