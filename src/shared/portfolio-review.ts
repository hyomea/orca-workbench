import { z } from 'zod'

// Whether the user looked at the code before accepting: reading it is optional, deciding is not.
export const PortfolioCodeReview = z.enum(['reviewed', 'skipped'])
export type PortfolioCodeReview = z.infer<typeof PortfolioCodeReview>
// The submitted commit tells the user which version they reviewed and accepted.
export const PortfolioCommit = z.string().regex(/^[0-9a-f]{7,64}$/)
