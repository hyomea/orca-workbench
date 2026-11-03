import {
  buildPortfolioDiscoveryPrompt,
  parsePortfolioObjectiveDraft,
  type PortfolioDiscover,
  type PortfolioDiscoveryResult
} from '../../shared/portfolio-discovery'
import { collectPortfolioSourceContext, type PortfolioSourceRoot } from './portfolio-source-context'
import { generatePortfolioText } from './portfolio-generation'
export { cancelPortfolioGeneration as cancelPortfolioDiscovery } from './portfolio-generation'

export async function discoverPortfolioObjective(
  request: PortfolioDiscover,
  options: Omit<
    Parameters<typeof generatePortfolioText>[1],
    'operation' | 'prompt' | 'readLinks'
  > & { roots: PortfolioSourceRoot[] }
): Promise<PortfolioDiscoveryResult> {
  if (options.roots.length === 0 && !request.notes) {
    throw new Error('Select a directory or describe your idea first.')
  }
  let sources: string[] = []
  let limited = false
  const output = await generatePortfolioText(request, {
    ...options,
    operation: 'project-objective',
    prompt: async (signal) => {
      const source = await collectPortfolioSourceContext(options.roots, signal)
      sources = source.sources
      limited = source.limited
      return buildPortfolioDiscoveryPrompt(request, source.context)
    }
  })
  try {
    return { draft: parsePortfolioObjectiveDraft(output), sources, limited }
  } catch {
    throw new Error(
      'The agent returned an incomplete initiative draft. Try again or write the objective manually.'
    )
  }
}
