import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'

export function PortfolioProjectSetupFooter({
  disabled,
  canSave,
  saving,
  showSave,
  onClose,
  onDiscard
}: {
  disabled: boolean
  canSave: boolean
  saving: boolean
  showSave: boolean
  onClose: () => void
  onDiscard: () => void
}): React.JSX.Element {
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  return (
    <div className="space-y-3">
      {confirmDiscard && (
        <p role="alert" className="text-sm">
          {translate(
            'portfolio.discardDraftPrompt',
            'Discard this draft and its AI analysis? Imported directories will remain in Orca.'
          )}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {confirmDiscard ? (
          <>
            <Button
              type="button"
              variant="ghost"
              disabled={disabled}
              onClick={() => setConfirmDiscard(false)}
            >
              {translate('portfolio.keepDraft', 'Keep editing')}
            </Button>
            <Button type="button" variant="ghost" disabled={disabled} onClick={onDiscard}>
              {translate('portfolio.confirmDiscardDraft', 'Confirm discard')}
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              disabled={disabled}
              onClick={() => setConfirmDiscard(true)}
            >
              {translate('portfolio.discardDraft', 'Discard draft')}
            </Button>
            <Button type="button" variant="ghost" disabled={disabled} onClick={onClose}>
              {translate('portfolio.closeKeepDraft', 'Close and keep draft')}
            </Button>
            {showSave && (
              <Button type="submit" disabled={!canSave || disabled}>
                {saving
                  ? translate('portfolio.saving', 'Saving…')
                  : translate('portfolio.confirmAndSave', 'Confirm and save')}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
