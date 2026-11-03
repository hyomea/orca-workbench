import { translate } from '@/i18n/i18n'
import type { PortfolioParityStatus } from '../../../../shared/portfolio-feature-parity'

export function parityStatusName(status: PortfolioParityStatus): string {
  switch (status) {
    case 'same':
      return translate('portfolio.paritySame', 'Same')
    case 'differs':
      return translate('portfolio.parityDiffers', 'Differs')
    case 'missing':
      return translate('portfolio.parityMissing', 'Missing')
    case 'platform-specific':
      return translate('portfolio.parityPlatformSpecific', 'Platform-specific (intended)')
    case 'unknown':
      return translate('portfolio.parityUnknown', 'Unknown')
  }
}
