import { useContext, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import type { PortfolioDesignAttachment } from '../../../../shared/portfolio-design'
import { PortfolioDesignContext } from './portfolio-design-actions'

const NO_ATTACHMENTS: PortfolioDesignAttachment[] = []

export function PortfolioDesignAttachments({
  attachments = NO_ATTACHMENTS,
  workItemId,
  editable = false,
  busy = false
}: {
  attachments?: PortfolioDesignAttachment[]
  workItemId?: string
  editable?: boolean
  busy?: boolean
}): React.JSX.Element | null {
  const actions = useContext(PortfolioDesignContext)
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{ id: string; source: string } | null>(null)
  async function run(action: () => Promise<unknown>): Promise<void> {
    setPending(true)
    setError('')
    try {
      await action()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setPending(false)
    }
  }
  if (!attachments.length && !editable) {
    return null
  }
  return (
    <section className="space-y-3">
      <h4 className="text-sm font-medium">
        {translate('portfolio.designScreenshots', 'Design screenshots')}
      </h4>
      {editable && actions && workItemId && (
        <>
          <p className="text-xs text-muted-foreground">
            {translate(
              'portfolio.designUploadHint',
              'PNG, JPEG, or WebP · up to 5 MiB each · 12 images. Attach before creating tasks or a test plan. Saved copies are shared with assigned agents.'
            )}
          </p>
          <Input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            aria-label={translate('portfolio.chooseDesignImage', 'Choose design image')}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) {
                void run(async () => {
                  if (!(await actions.attach(workItemId, file))) {
                    throw new Error(
                      translate(
                        'portfolio.designSaveFailed',
                        'Image was not saved. Review the error and try again.'
                      )
                    )
                  }
                })
              }
            }}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={busy || pending || attachments.length >= 12}
            onClick={() => input.current?.click()}
          >
            {pending
              ? translate('portfolio.working', 'Working…')
              : translate('portfolio.attachDesign', 'Attach screenshot')}
          </Button>
        </>
      )}
      {attachments.map((attachment) => (
        <div key={attachment.id} className="space-y-2 rounded-md border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 break-words text-sm">{attachment.name}</span>
            <div className="flex gap-2">
              {actions && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    if (preview?.id === attachment.id) {
                      setPreview(null)
                      return
                    }
                    void run(async () =>
                      setPreview({ id: attachment.id, source: await actions.read(attachment.id) })
                    )
                  }}
                >
                  {preview?.id === attachment.id
                    ? translate('portfolio.hideImage', 'Hide image')
                    : translate('portfolio.viewImage', 'View image')}
                </Button>
              )}
              {editable && actions && workItemId && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending || busy}
                  onClick={() =>
                    void run(async () => {
                      if (!(await actions.remove(workItemId, attachment.id))) {
                        throw new Error(
                          translate(
                            'portfolio.designRemoveFailed',
                            'Image was not removed. Review the error and try again.'
                          )
                        )
                      }
                    })
                  }
                >
                  {translate('portfolio.removeImage', 'Remove')}
                </Button>
              )}
            </div>
          </div>
          {preview?.id === attachment.id && (
            <img
              src={preview.source}
              alt={attachment.name}
              className="max-h-96 max-w-full rounded-md object-contain"
            />
          )}
        </div>
      ))}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
