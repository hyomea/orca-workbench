import { z } from 'zod'

const Text = z.string().trim().max(4000)
export const PortfolioParityStatus = z.enum([
  'same',
  'differs',
  'missing',
  'platform-specific',
  'unknown'
])
export type PortfolioParityStatus = z.infer<typeof PortfolioParityStatus>
// One platform's side of a feature's parity record: what was found, why, and how it was checked.
const PortfolioParityCheck = z
  .object({
    status: PortfolioParityStatus,
    note: Text,
    evidence: Text,
    checkedOn: z.iso.date().optional()
  })
  .refine(
    (check) => check.status === 'same' || check.note,
    'Explain any status other than same, including why it is unknown.'
  )
  .refine(
    (check) => check.status === 'unknown' || (check.evidence && check.checkedOn),
    'Record the evidence and the date it was checked.'
  )
export type PortfolioParityCheck = z.infer<typeof PortfolioParityCheck>
// A feature's row in the parity inventory.
export const PortfolioFeatureParity = z.object({
  ios: PortfolioParityCheck,
  android: PortfolioParityCheck,
  ruleLocation: Text,
  needsHardware: z.boolean()
})
export type PortfolioFeatureParity = z.infer<typeof PortfolioFeatureParity>
