import type {
  PortfolioDiscover,
  PortfolioDiscoveryResult
} from '../../../../shared/portfolio-discovery'

export type PortfolioImportCandidate = { path: string; name: string; kind: 'git' | 'folder' }
export type PortfolioSetupActions = {
  pickSources: () => Promise<PortfolioImportCandidate[]>
  importSource: (source: PortfolioImportCandidate) => Promise<{ id: string; name: string }>
  discover: (request: PortfolioDiscover) => Promise<PortfolioDiscoveryResult>
  cancelDiscovery: (requestId: string) => Promise<void>
}
