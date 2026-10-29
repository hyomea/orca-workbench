import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { PortfolioIntakeResult, type PortfolioIntake } from '../../../../shared/portfolio-intake'

export async function readPortfolioIntake(
  request: PortfolioIntake
): Promise<PortfolioIntakeResult> {
  return PortfolioIntakeResult.parse(
    await callRuntimeRpc({ kind: 'local' }, 'portfolio.intake', request, { timeoutMs: 200000 })
  )
}
export async function cancelPortfolioIntake(requestId: string): Promise<void> {
  await callRuntimeRpc(
    { kind: 'local' },
    'portfolio.cancelDiscovery',
    { requestId },
    { timeoutMs: 15000 }
  )
}
