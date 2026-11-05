import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import type { PortfolioCommand } from '../../../../shared/portfolio'

// The user confirms an execution is over, with what they checked, so the task can run again.
export function PortfolioEndExecution({
  taskId,
  busy,
  onSave
}: {
  taskId: string
  busy: boolean
  onSave: (command: PortfolioCommand) => Promise<boolean>
}): React.JSX.Element {
  const [stopNote, setStopNote] = useState('')
  return (
    <div className="space-y-2">
      <Textarea
        aria-label={translate('portfolio.endExecutionNote', 'What you checked')}
        placeholder={translate(
          'portfolio.endExecutionPlaceholder',
          'For example: the agent exited at a permission prompt; nothing was changed.'
        )}
        value={stopNote}
        onChange={(event) => setStopNote(event.target.value)}
        rows={2}
        maxLength={20000}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={busy || !stopNote.trim()}
        onClick={async () => {
          if (await onSave({ kind: 'task.closeExecution', taskId, note: stopNote })) {
            setStopNote('')
          }
        }}
      >
        {translate('portfolio.endExecution', 'End this execution')}
      </Button>
    </div>
  )
}
