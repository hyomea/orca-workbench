import { randomUUID } from 'node:crypto'
import { stat } from 'node:fs/promises'
import { beforeEach, expect, it, vi } from 'vitest'
import { runGenerationRequest } from '../text-generation/agent-generation-request'
import { discoverPortfolioObjective, cancelPortfolioDiscovery } from './portfolio-discovery'
import type { PortfolioDiscover } from '../../shared/portfolio-discovery'
import { PORTFOLIO_DISCOVERY_METHODS } from '../runtime/rpc/methods/portfolio-discovery'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'

vi.mock('../text-generation/agent-generation-request', () => ({ runGenerationRequest: vi.fn() }))
vi.mock('../text-generation/commit-message-agent-environment', () => ({
  prepareLocalCommitMessageAgentEnv: async () => ({ ok: true, env: {} })
}))
const draft = {
  name: 'Arts hub',
  summary: 'Based on the user’s idea.',
  objective: 'Explore opportunities in the arts.',
  questions: []
}
const options = {
  owner: 'desktop:1',
  roots: [],
  settings: { disabledTuiAgents: [], agentCmdOverrides: {} },
  environment: undefined
}
function request(): PortfolioDiscover {
  return {
    requestId: randomUUID(),
    repoIds: [],
    agent: 'codex',
    language: 'zh',
    notes: '探索表演艺术的可能性'
  }
}
beforeEach(() => vi.clearAllMocks())

it('parses a provider draft, preserves user intent in the prompt, and removes its temporary workspace', async () => {
  vi.mocked(runGenerationRequest).mockResolvedValue({
    success: true,
    rawOutput: JSON.stringify(draft)
  })
  const result = await discoverPortfolioObjective(request(), options)
  expect(result.draft.objective).toBe('Explore opportunities in the arts.')
  const input = vi.mocked(runGenerationRequest).mock.calls[0][0]
  expect(input.prompt).toContain('Simplified Chinese')
  expect(input.prompt).toContain('探索表演艺术的可能性')
  expect(input.target.kind).toBe('local')
  if (input.target.kind !== 'local') {
    throw new Error('Expected a local generation target')
  }
  await expect(stat(input.target.cwd)).rejects.toMatchObject({ code: 'ENOENT' })
})

it('rejects malformed provider output instead of returning a savable draft', async () => {
  vi.mocked(runGenerationRequest).mockResolvedValue({
    success: true,
    rawOutput: 'I have changed your project.'
  })
  await expect(discoverPortfolioObjective(request(), options)).rejects.toThrow(
    'incomplete project draft'
  )
})

it('accepts desktop IPC callers and rejects source IDs unavailable on the host before generation', async () => {
  const method = PORTFOLIO_DISCOVERY_METHODS.find((entry) => entry.name === 'portfolio.discover')
  if (!method) {
    throw new Error('Discovery method missing')
  }
  const stub = {
    listVisibleRepos: () => [],
    listVisibleFolderWorkspaces: () => [],
    getClientSettings: () => options.settings,
    getCommitMessageAgentEnvironmentResolvers: () => undefined
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: discovery only reads the supplied runtime methods.
  const runtime = stub as unknown as OrcaRuntimeService
  const context = { runtime, caller: { kind: 'desktop' as const }, connectionId: 'window-1' }
  vi.mocked(runGenerationRequest).mockResolvedValue({
    success: true,
    rawOutput: JSON.stringify(draft)
  })
  const result = await method.handler(request(), context)
  expect(result).toMatchObject({ draft: { name: 'Arts hub' } })
  vi.mocked(runGenerationRequest).mockClear()
  expect(() => method.handler({ ...request(), repoIds: ['unavailable'] }, context)).toThrow(
    'unavailable'
  )
  expect(runGenerationRequest).not.toHaveBeenCalled()
})

it('scopes cancellation to the caller, rejects overlapping requests, and discards canceled output', async () => {
  let finish!: () => void
  let started!: () => void
  const ready = new Promise<void>((resolve) => {
    started = resolve
  })
  vi.mocked(runGenerationRequest).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = () => resolve({ success: true, rawOutput: JSON.stringify(draft) })
        started()
      })
  )
  const input = request()
  const pending = discoverPortfolioObjective(input, options)
  const rejected = expect(pending).rejects.toThrow()
  await ready
  cancelPortfolioDiscovery('another-device', input.requestId)
  expect(vi.mocked(runGenerationRequest).mock.calls[0][0].shouldExecute?.()).toBe(true)
  await expect(discoverPortfolioObjective(request(), options)).rejects.toThrow('still running')
  cancelPortfolioDiscovery(options.owner, input.requestId)
  expect(vi.mocked(runGenerationRequest).mock.calls[0][0].shouldExecute?.()).toBe(false)
  finish()
  await rejected
})
