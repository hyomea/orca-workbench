import { z } from 'zod'
import { applyPortfolioCommand, PortfolioCommand, type PortfolioState } from './portfolio'

const REF = /^\$ref:([A-Za-z0-9_-]{1,64})$/
export const PortfolioBatchStep = z.object({
  ref: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,64}$/)
    .optional(),
  command: z.unknown()
})
export const PortfolioBatch = z.object({
  revision: z.number().int().nonnegative().optional(),
  steps: z.array(PortfolioBatchStep).min(1).max(200)
})
export type PortfolioBatchStep = z.infer<typeof PortfolioBatchStep>

// A step names the entity it creates; later steps use "$ref:<name>" for its generated id.
export function applyPortfolioBatch(
  state: PortfolioState,
  steps: readonly PortfolioBatchStep[],
  newId: () => string,
  now: number,
  beforeCommand: (command: PortfolioCommand) => void = () => {}
): Record<string, string> {
  const refs: Record<string, string> = {}
  steps.forEach((step, index) => {
    const id = newId()
    try {
      const command = PortfolioCommand.parse(resolveRefs(step.command, refs))
      beforeCommand(command)
      applyPortfolioCommand(state, command, id, now)
    } catch (error) {
      const kind = (step.command as { kind?: unknown } | null)?.kind
      throw new Error(
        `Step ${index + 1}${typeof kind === 'string' ? ` (${kind})` : ''}: ${error instanceof z.ZodError ? z.prettifyError(error) : error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      )
    }
    if (step.ref) {
      if (step.ref in refs) {
        throw new Error(`Step ${index + 1}: ref "${step.ref}" is already used.`)
      }
      refs[step.ref] = id
    }
  })
  return refs
}

function resolveRefs(value: unknown, refs: Record<string, string>): unknown {
  if (typeof value === 'string') {
    const name = REF.exec(value)?.[1]
    if (name === undefined) {
      return value
    }
    if (!(name in refs)) {
      throw new Error(`Unknown ref "${name}". Refs must be defined by an earlier step.`)
    }
    return refs[name]
  }
  if (Array.isArray(value)) {
    return value.map((entry) => resolveRefs(entry, refs))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, resolveRefs(entry, refs)])
    )
  }
  return value
}
