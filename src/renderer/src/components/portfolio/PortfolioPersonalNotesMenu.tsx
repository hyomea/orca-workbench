import { ChevronDown, FolderOpen, NotebookText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'

export function PortfolioPersonalNotesMenu({
  disabled,
  onOpen,
  onChooseFolder
}: {
  disabled: boolean
  onOpen: () => void
  onChooseFolder: () => void
}): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button variant="outline" size="sm">
          <NotebookText aria-hidden="true" />
          {translate('portfolio.personalNotes', 'Notes')}
          <ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onOpen}>
          <NotebookText aria-hidden="true" />
          {translate('portfolio.openPersonalNotes', 'Open my notes')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onChooseFolder}>
          <FolderOpen aria-hidden="true" />
          {translate('portfolio.choosePersonalNotesFolder', 'Choose notes folder…')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
