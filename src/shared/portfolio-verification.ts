import { z } from 'zod'
import { PortfolioDesignAttachments } from './portfolio-design'
import type { PortfolioState } from './portfolio'

const Id = z.string().trim().min(1).max(4096)
const Note = z.string().trim().min(1).max(12000)
export const PortfolioPlatform = z.enum(['ios', 'android'])
export const PortfolioScenario = z.object({
  id: Id,
  criterion: z.string().trim().min(1).max(2000),
  steps: z.string().trim().min(1).max(2000),
  testData: z.string().trim().min(1).max(2000),
  expected: z.string().trim().min(1).max(2000),
  platformNotes: z.string().trim().max(2000)
})
const Confirmation = z.object({ at: z.number(), note: Note })
export const PortfolioVerificationPlan = z.object({
  version: z.number().int().positive(),
  scenarios: z.array(PortfolioScenario).min(1).max(20),
  acceptanceCriteria: Note,
  designReferences: z.string(),
  designAttachments: PortfolioDesignAttachments,
  sourceReference: z.string(),
  at: z.number(),
  note: Note,
  confirmation: Confirmation.optional()
})
export const PortfolioTestResultInput = z.object({
  scenarioId: Id,
  platform: PortfolioPlatform,
  outcome: z.enum(['pass', 'fail', 'blocked']),
  build: z.string().trim().min(1).max(2000),
  environment: z.string().trim().min(1).max(2000),
  evidence: Note
})
export const PortfolioTestResult = PortfolioTestResultInput.extend({
  id: Id,
  planVersion: z.number().int().positive(),
  taskSnapshot: z.string(),
  at: z.number(),
  review: Confirmation.extend({ decision: z.enum(['approved', 'rejected']) }).optional(),
  fixTaskId: Id.optional()
})
export const PortfolioVerification = z.object({
  workItemId: Id,
  plans: z.array(PortfolioVerificationPlan),
  results: z.array(PortfolioTestResult)
})
export type PortfolioScenario = z.infer<typeof PortfolioScenario>
export type PortfolioTestResult = z.infer<typeof PortfolioTestResult>
export type PortfolioVerificationPlan = z.infer<typeof PortfolioVerificationPlan>
export const PortfolioVerificationCommands = [
  z.object({
    kind: z.literal('verification.plan'),
    workItemId: Id,
    expectedVersion: z.number().int().nonnegative(),
    scenarios: z.array(PortfolioScenario).min(1).max(20),
    note: Note
  }),
  z.object({
    kind: z.literal('verification.confirm'),
    workItemId: Id,
    planVersion: z.number().int().positive(),
    note: Note
  }),
  z.object({
    kind: z.literal('verification.record'),
    workItemId: Id,
    planVersion: z.number().int().positive(),
    expectedTaskSnapshot: z.string(),
    result: PortfolioTestResultInput
  }),
  z.object({
    kind: z.literal('verification.review'),
    workItemId: Id,
    resultId: Id,
    decision: z.enum(['approved', 'rejected']),
    note: Note
  }),
  z.object({ kind: z.literal('verification.fix'), workItemId: Id, resultId: Id, roleId: Id })
] as const

export function verificationTaskSnapshot(state: PortfolioState, workItemId: string): string {
  return JSON.stringify(
    state.tasks
      .filter((task) => task.workItemId === workItemId)
      .map((task) => ({
        id: task.id,
        attempts: task.attempts.map((attempt) => attempt.operationId),
        changes: task.history
          .filter((entry) => ['todo', 'running', 'blocked'].includes(entry.status))
          .map((entry) => entry.id)
      }))
      .sort((a, b) => a.id.localeCompare(b.id))
  )
}

export function verificationProgress(state: PortfolioState, workItemId: string) {
  const verification = state.verification.find((entry) => entry.workItemId === workItemId)
  const plan = verification?.plans.at(-1)
  const snapshot = verificationTaskSnapshot(state, workItemId)
  const cells = (plan?.scenarios ?? []).flatMap((scenario) =>
    PortfolioPlatform.options.map((platform) => {
      const result = verification?.results.findLast(
        (entry) =>
          entry.planVersion === plan?.version &&
          entry.scenarioId === scenario.id &&
          entry.platform === platform
      )
      const current = !!result && result.taskSnapshot === snapshot
      return {
        scenario,
        platform,
        result,
        current,
        passed: current && result.outcome === 'pass' && result.review?.decision === 'approved'
      }
    })
  )
  const passed = cells.filter((cell) => cell.passed).length
  return {
    verification,
    plan,
    cells,
    passed,
    total: cells.length,
    ready: !!plan?.confirmation && cells.length > 0 && passed === cells.length
  }
}
