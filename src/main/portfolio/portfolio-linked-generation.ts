import {
  planCommitMessageGeneration,
  type CommitMessagePlan
} from '../../shared/source-control/ai/generation/commit-message-plan'
import {
  commandBackslashMode,
  runGenerationRequest
} from '../text-generation/agent-generation-request'
import { runLocalPlanForAgent } from '../text-generation/source-control-local-generation'

// Text generation denies every MCP tool when MCP servers load; deny outranks allow, so drop that
// rule here. dontAsk still refuses any tool not allowed, so only the named Figma reads can run.
function allowNamedMcpReads(plan: CommitMessagePlan): CommitMessagePlan {
  const at = plan.args.findIndex(
    (arg, index) => arg === '--disallowedTools' && plan.args[index + 1] === 'mcp__*'
  )
  if (at === -1) {
    return plan
  }
  const shift = (index: number): number => (index > at ? index - 2 : index)
  return {
    ...plan,
    args: plan.args.filter((_, index) => index !== at && index !== at + 1),
    ...(plan.promptFile
      ? { promptFile: { ...plan.promptFile, argIndex: shift(plan.promptFile.argIndex) } }
      : {}),
    ...(plan.taskFiles
      ? {
          taskFiles: plan.taskFiles.map((file) =>
            file.argIndex === undefined ? file : { ...file, argIndex: shift(file.argIndex) }
          )
        }
      : {})
  }
}

export async function runPortfolioLinkedGeneration(
  input: Parameters<typeof runGenerationRequest>[0]
) {
  if (input.params.agentId !== 'claude' || input.target.kind !== 'local') {
    return runGenerationRequest(input)
  }
  const readTools = [
    'WebFetch',
    'mcp__figma__get_design_context',
    'mcp__figma__get_screenshot',
    'mcp__figma__get_metadata',
    'mcp__figma__get_variable_defs'
  ].join(',')
  const planned = planCommitMessageGeneration(
    {
      ...input.params,
      backslash: commandBackslashMode(input.target),
      agentArgs: `--tools WebFetch --allowedTools ${readTools} --no-session-persistence`
    },
    input.prompt,
    { strictMcp: false }
  )
  if (!planned.ok) {
    return { success: false as const, error: planned.error }
  }
  return runLocalPlanForAgent({
    agentId: input.params.agentId,
    plan: allowNamedMcpReads(planned.plan),
    target: input.target,
    operation: input.operation,
    spawnAgent: input.spawnAgent,
    shouldExecute: input.shouldExecute
  })
}
