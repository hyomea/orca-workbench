import { Ellipsis, FolderOpen, NotebookText, Pencil, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'

// Less frequent page actions, including the user's own notes folder, which every initiative
// shares (an initiative's notes for its agents live in its Context & notes panel).
export function PortfolioWorkbenchMenu({
  disabled,
  onRefresh,
  onRename,
  stewardAgent,
  onStewardAgentChange,
  onOpenNotes,
  onChooseNotesFolder
}: {
  disabled: boolean
  onRefresh: () => void
  onRename: () => void
  stewardAgent: 'codex' | 'claude'
  onStewardAgentChange: (agent: 'codex' | 'claude') => void
  onOpenNotes: () => void
  onChooseNotesFolder: () => void
}): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={translate('portfolio.workbenchActions', 'More Workbench actions')}
        >
          <Ellipsis aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onRefresh}>
          <RefreshCw aria-hidden="true" />
          {translate('portfolio.refresh', 'Refresh')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onRename}>
          <Pencil aria-hidden="true" />
          {translate('portfolio.renameWorkbench', 'Rename workbench')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>
          {translate('portfolio.stewardAgentChoice', 'Steward agent (next session)')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={stewardAgent}
          onValueChange={(value) => {
            if (value === 'codex' || value === 'claude') {
              onStewardAgentChange(value)
            }
          }}
        >
          <DropdownMenuRadioItem value="codex">Codex</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="claude">Claude</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{translate('portfolio.myNotes', 'My notes')}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={onOpenNotes}>
          <NotebookText aria-hidden="true" />
          {translate('portfolio.openPersonalNotes', 'Open my notes')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onChooseNotesFolder}>
          <FolderOpen aria-hidden="true" />
          {translate('portfolio.choosePersonalNotesFolder', 'Choose notes folder…')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
