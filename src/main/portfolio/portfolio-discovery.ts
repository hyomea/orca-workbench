import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildPortfolioDiscoveryPrompt,
  parsePortfolioObjectiveDraft,
  type PortfolioDiscover,
  type PortfolioDiscoveryResult
} from '../../shared/portfolio-discovery'
import { getCommitMessageAgentSpec } from '../../shared/commit-message-agent-spec'
import { isTuiAgentEnabled } from '../../shared/tui-agent-selection'
import type { GlobalSettings } from '../../shared/global-settings-types'
import {
  prepareLocalCommitMessageAgentEnv,
  type CommitMessageAgentEnvironmentResolvers
} from '../text-generation/commit-message-agent-environment'
import { runGenerationRequest } from '../text-generation/agent-generation-request'
import { spawnSourceControlAgent } from '../text-generation/source-control-agent-launch'
import { cancelLocalGeneration } from '../text-generation/source-control-generation-lanes'
import { collectPortfolioSourceContext, type PortfolioSourceRoot } from './portfolio-source-context'

const requests = new Map<string, { owner: string; controller: AbortController; cwd?: string }>()

export function cancelPortfolioDiscovery(owner: string, requestId: string): void {
  const active = requests.get(requestId)
  if (active?.owner !== owner) {
    return
  }
  active.controller.abort()
  if (active.cwd) {
    cancelLocalGeneration('project-objective', active.cwd)
  }
}

export async function discoverPortfolioObjective(
  request: PortfolioDiscover,
  options: {
    owner: string
    roots: PortfolioSourceRoot[]
    settings: Pick<GlobalSettings, 'disabledTuiAgents' | 'agentCmdOverrides'>
    environment: CommitMessageAgentEnvironmentResolvers | undefined
    signal?: AbortSignal
  }
): Promise<PortfolioDiscoveryResult> {
  if (
    requests.has(request.requestId) ||
    [...requests.values()].some((active) => active.owner === options.owner)
  ) {
    throw new Error(
      'Another project analysis is still running. Wait for it to finish or stop it first.'
    )
  }
  if (options.roots.length === 0 && !request.notes) {
    throw new Error('Select a directory or describe your idea first.')
  }
  if (!isTuiAgentEnabled(request.agent, options.settings.disabledTuiAgents)) {
    throw new Error('This agent is disabled in settings.')
  }
  const spec = getCommitMessageAgentSpec(request.agent)
  if (!spec) {
    throw new Error('This agent cannot generate a project objective.')
  }
  const active: { owner: string; controller: AbortController; cwd?: string } = {
    owner: options.owner,
    controller: new AbortController()
  }
  requests.set(request.requestId, active)
  const cancel = (): void => cancelPortfolioDiscovery(options.owner, request.requestId)
  options.signal?.addEventListener('abort', cancel, { once: true })
  if (options.signal?.aborted) {
    cancel()
  }
  const timer = setTimeout(cancel, 180000)
  try {
    const source = await collectPortfolioSourceContext(options.roots, active.controller.signal)
    const env = await prepareLocalCommitMessageAgentEnv(request.agent, options.environment)
    if (!env.ok) {
      throw new Error(env.error)
    }
    active.controller.signal.throwIfAborted()
    active.cwd = await mkdtemp(join(tmpdir(), 'orca-project-objective-'))
    const generated = await runGenerationRequest({
      params: {
        agentId: request.agent,
        model: spec.defaultModelId,
        agentCommandOverride: options.settings.agentCmdOverrides?.[request.agent],
        ...(request.agent === 'claude' ? { agentArgs: '--tools ""' } : {})
      },
      prompt: buildPortfolioDiscoveryPrompt(request, source.context),
      operation: 'project-objective',
      target: { kind: 'local', cwd: active.cwd, env: env.env },
      spawnAgent: spawnSourceControlAgent,
      shouldExecute: () => !active.controller.signal.aborted
    })
    active.controller.signal.throwIfAborted()
    if (!generated.success) {
      throw new Error(generated.error)
    }
    let draft
    try {
      draft = parsePortfolioObjectiveDraft(generated.rawOutput)
    } catch {
      throw new Error(
        'The agent returned an incomplete project draft. Try again or write the objective manually.'
      )
    }
    return { draft, sources: source.sources, limited: source.limited }
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', cancel)
    if (active.cwd) {
      await rm(active.cwd, { recursive: true, force: true }).catch(() => {})
    }
    requests.delete(request.requestId)
  }
}
