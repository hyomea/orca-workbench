import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getCommitMessageAgentSpec } from '../../shared/source-control/ai/generation/commit-message-agent-spec'
import { isTuiAgentEnabled } from '../../shared/agent-launch/catalog/tui-agent-selection'
import type { GlobalSettings } from '../../shared/global-settings-types'
import {
  prepareLocalCommitMessageAgentEnv,
  type CommitMessageAgentEnvironmentResolvers
} from '../text-generation/commit-message-agent-environment'
import { runGenerationRequest } from '../text-generation/agent-generation-request'
import { spawnSourceControlAgent } from '../text-generation/source-control-agent-launch'
import { cancelLocalGeneration } from '../text-generation/source-control-generation-lanes'
import { runPortfolioLinkedGeneration } from './portfolio-linked-generation'

type PortfolioGenerationOperation = 'project-objective' | 'work-item-intake'

const requests = new Map<
  string,
  {
    owner: string
    controller: AbortController
    cwd?: string
    operation: PortfolioGenerationOperation
  }
>()

export function cancelPortfolioGeneration(owner: string, requestId: string): void {
  const active = requests.get(requestId)
  if (active?.owner !== owner) {
    return
  }
  active.controller.abort()
  if (active.cwd) {
    cancelLocalGeneration(active.operation, active.cwd)
  }
}

export async function generatePortfolioText(
  request: { requestId: string; agent: 'codex' | 'claude' },
  options: {
    owner: string
    operation: PortfolioGenerationOperation
    prompt: (signal: AbortSignal) => Promise<string>
    readLinks?: boolean
    settings: Pick<GlobalSettings, 'disabledTuiAgents' | 'agentCmdOverrides'>
    environment: CommitMessageAgentEnvironmentResolvers | undefined
    signal?: AbortSignal
  }
): Promise<string> {
  if (
    requests.has(request.requestId) ||
    [...requests.values()].some((active) => active.owner === options.owner)
  ) {
    throw new Error(
      'Another initiative analysis is still running. Wait for it to finish or stop it first.'
    )
  }
  if (!isTuiAgentEnabled(request.agent, options.settings.disabledTuiAgents)) {
    throw new Error('This agent is disabled in settings.')
  }
  const spec = getCommitMessageAgentSpec(request.agent)
  if (!spec) {
    throw new Error('This agent cannot generate an initiative objective.')
  }
  const active: {
    owner: string
    controller: AbortController
    cwd?: string
    operation: PortfolioGenerationOperation
  } = {
    owner: options.owner,
    operation: options.operation,
    controller: new AbortController()
  }
  requests.set(request.requestId, active)
  const cancel = (): void => cancelPortfolioGeneration(options.owner, request.requestId)
  options.signal?.addEventListener('abort', cancel, { once: true })
  if (options.signal?.aborted) {
    cancel()
  }
  const timer = setTimeout(cancel, 180000)
  try {
    const prompt = await options.prompt(active.controller.signal)
    const env = await prepareLocalCommitMessageAgentEnv(request.agent, options.environment)
    if (!env.ok) {
      throw new Error(env.error)
    }
    active.controller.signal.throwIfAborted()
    active.cwd = await mkdtemp(join(tmpdir(), `orca-${options.operation}-`))
    const generated = await (
      options.readLinks ? runPortfolioLinkedGeneration : runGenerationRequest
    )({
      params: {
        agentId: request.agent,
        model: spec.defaultModelId,
        agentCommandOverride: options.settings.agentCmdOverrides?.[request.agent],
        ...(!options.readLinks && request.agent === 'claude' ? { agentArgs: '--tools ""' } : {})
      },
      prompt,
      operation: options.operation,
      target: { kind: 'local', cwd: active.cwd, env: env.env },
      spawnAgent: spawnSourceControlAgent,
      shouldExecute: () => !active.controller.signal.aborted
    })
    active.controller.signal.throwIfAborted()
    if (!generated.success) {
      throw new Error(generated.error)
    }
    return generated.rawOutput
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', cancel)
    if (active.cwd) {
      await rm(active.cwd, { recursive: true, force: true }).catch(() => {})
    }
    requests.delete(request.requestId)
  }
}
