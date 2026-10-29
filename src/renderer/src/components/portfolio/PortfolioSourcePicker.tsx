import { FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { translate } from '@/i18n/i18n'
import type { usePortfolioSourceImport } from './use-portfolio-source-import'

export function PortfolioSourcePicker({
  repos,
  selected,
  onChange,
  sourceImport,
  disabled,
  manual
}: {
  repos: readonly { id: string; name: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
  sourceImport: ReturnType<typeof usePortfolioSourceImport>
  disabled: boolean
  manual: boolean
}): React.JSX.Element {
  const { candidates, picked, setPicked, added, phase, error, browse, importSelected } =
    sourceImport
  const working = phase !== 'idle'
  const choices = [
    ...new Map(
      [...selected.map((id) => ({ id, name: id })), ...repos, ...added].map((repo) => [
        repo.id,
        repo
      ])
    ).values()
  ]
  return (
    <fieldset disabled={disabled || working} className="space-y-3">
      <legend className="mb-2 text-sm font-medium">
        {translate('portfolio.sourceDirectories', 'Project directories')}
      </legend>
      <p className="text-xs text-muted-foreground">
        {translate(
          'portfolio.sourcesHint',
          'Choose existing sources or import a directory. Imports remain in Orca even if you cancel project setup.'
        )}
      </p>
      <div className="max-h-48 space-y-2 overflow-y-auto scrollbar-sleek">
        {choices.map((repo) => (
          <label
            key={repo.id}
            className="flex items-center gap-3 rounded-md border border-border p-3 text-sm"
          >
            <Checkbox
              checked={selected.includes(repo.id)}
              disabled={disabled || working}
              onCheckedChange={(checked) =>
                onChange(
                  checked === true
                    ? [...selected, repo.id]
                    : selected.filter((id) => id !== repo.id)
                )
              }
            />
            <span className="min-w-0 break-words">{repo.name}</span>
          </label>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || working}
        onClick={() => void browse()}
      >
        <FolderOpen aria-hidden="true" />
        {translate('portfolio.importDirectory', 'Import directory')}
      </Button>
      {(phase === 'browsing' || (manual && phase === 'importing')) && (
        <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
          <LoadingSpinner className="size-4" />
          {phase === 'importing'
            ? translate('portfolio.importingDirectories', 'Importing selected directories…')
            : translate('portfolio.readingDirectories', 'Reading directories…')}
        </p>
      )}
      {candidates.length > 0 && (
        <div className="space-y-3 rounded-md border border-border p-3">
          <p className="text-xs text-muted-foreground">
            {translate(
              'portfolio.chooseImports',
              'Select what to import. A folder includes its contents; choose individual repositories for separate workspaces.'
            )}
          </p>
          <div className="max-h-48 space-y-3 overflow-y-auto scrollbar-sleek">
            {candidates.map((entry) => (
              <label key={entry.path} className="flex items-start gap-2 text-sm">
                <Checkbox
                  disabled={disabled || working}
                  checked={picked.includes(entry.path)}
                  onCheckedChange={(checked) =>
                    setPicked((current) =>
                      checked === true
                        ? [...current, entry.path]
                        : current.filter((path) => path !== entry.path)
                    )
                  }
                />
                <span className="min-w-0">
                  <span className="block break-words">
                    {entry.name} ·{' '}
                    {entry.kind === 'git'
                      ? translate('portfolio.gitRepository', 'Git repository')
                      : translate('portfolio.folder', 'Folder')}
                  </span>
                  <span className="block break-all font-mono text-xs text-muted-foreground">
                    {entry.path}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {manual && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled || working || !picked.length}
              onClick={() => void importSelected()}
            >
              {translate('portfolio.importSelected', 'Import selected')}
            </Button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  )
}
