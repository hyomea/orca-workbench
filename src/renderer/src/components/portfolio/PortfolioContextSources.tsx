import type { PortfolioIntakeSource } from '../../../../shared/portfolio-intake'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { JiraSite } from '../../../../shared/jira/jira-types'
import { PortfolioField, PortfolioSelect } from './portfolio-controls'
import {
  portfolioDesignLink,
  portfolioJiraCandidates,
  readPortfolioJiraSites,
  readPortfolioJiraTicket,
  type PortfolioJiraPreview
} from './portfolio-context-sources'

export function PortfolioContextSources({
  mode,
  url,
  preview,
  designReferences,
  busy,
  onMode,
  onUrl,
  onPreview,
  onAnalyze,
  onDesignReferences,
  onPending
}: {
  mode: string
  url: string
  preview?: PortfolioJiraPreview
  designReferences: string
  busy: boolean
  onMode: (value: string) => void
  onUrl: (value: string) => void
  onPreview: (value: PortfolioJiraPreview | undefined) => void
  onAnalyze: (value: PortfolioIntakeSource) => Promise<void>
  onDesignReferences: (value: string) => void
  onPending: (value: boolean) => void
}): React.JSX.Element {
  const [sites, setSites] = useState<JiraSite[]>([])
  const [siteId, setSiteId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)
  const [disconnected, setDisconnected] = useState(false)
  async function load(): Promise<void> {
    setPending(true)
    onPending(true)
    setError('')
    setNotice('')
    onPreview(undefined)
    try {
      const connected = await readPortfolioJiraSites()
      setDisconnected(!connected.length)
      const matches = portfolioJiraCandidates(url, connected)
      setSites(matches)
      const selected =
        matches.find((site) => site.id === siteId) ??
        (matches.length === 1 ? matches[0] : undefined)
      if (!connected.length) {
        throw new Error(
          translate(
            'portfolio.jiraNotConnected',
            'Connect Jira in local integrations settings, then try again.'
          )
        )
      }
      if (!matches.length) {
        throw new Error(
          translate(
            'portfolio.jiraNoMatchingSite',
            'Enter an issue key or a ticket URL from a connected Jira site.'
          )
        )
      }
      if (!selected) {
        throw new Error(
          translate(
            'portfolio.jiraChooseAccount',
            'Choose a Jira account below, then load the ticket again.'
          )
        )
      }
      setSiteId(selected.id)
      const ticket = await readPortfolioJiraTicket(url, selected)
      onPreview(ticket)
      await onAnalyze({
        url: ticket.url,
        title: ticket.title,
        content: ticket.description || ticket.title,
        clipped: ticket.clipped
      })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setPending(false)
      onPending(false)
    }
  }
  async function attachDesign(): Promise<void> {
    setPending(true)
    onPending(true)
    setError('')
    setNotice('')
    try {
      const link = portfolioDesignLink(url)
      const reference = `${link.label}: ${link.url}`
      const next = designReferences.includes(link.url)
        ? designReferences
        : [designReferences.trim(), reference].filter(Boolean).join('\n\n')
      if (next.length > 12000) {
        throw new Error(
          translate(
            'portfolio.designReferenceTooLong',
            'Shorten the design notes before adding another link.'
          )
        )
      }
      onDesignReferences(next)
      await onAnalyze({ url: link.url, title: link.label, content: '', clipped: false })
      setNotice(
        translate(
          'portfolio.designLinkAttached',
          'Link retained in design references. Review the source access report and draft below.'
        )
      )
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setPending(false)
      onPending(false)
    }
  }
  return (
    <section className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto text-sm font-medium">
          {translate('portfolio.addSharedContext', 'Add shared context')}
        </h3>
        {[
          { id: 'jira', name: translate('portfolio.jiraTicket', 'Jira ticket') },
          { id: 'design', name: translate('portfolio.designLink', 'Design link') }
        ].map((entry) => (
          <Button
            key={entry.id}
            type="button"
            size="sm"
            variant={mode === entry.id ? 'secondary' : 'outline'}
            disabled={busy || pending}
            aria-pressed={mode === entry.id}
            onClick={() => {
              onMode(mode === entry.id ? '' : entry.id)
              setError('')
              setNotice('')
            }}
          >
            {entry.name}
          </Button>
        ))}
      </div>
      {mode && (
        <>
          <PortfolioField
            label={
              mode === 'jira'
                ? translate('portfolio.jiraTicketAddress', 'Ticket URL or issue key')
                : translate('portfolio.designLinkAddress', 'Figma or Claude Design link')
            }
          >
            <Input
              value={url}
              disabled={busy || pending}
              maxLength={2000}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  if (!busy && !pending && url.trim()) {
                    if (mode === 'jira') {
                      void load()
                    } else {
                      void attachDesign()
                    }
                  }
                }
              }}
              placeholder={mode === 'jira' ? 'MOBILE-123' : 'https://…'}
              onChange={(event) => {
                onUrl(event.target.value)
                onPreview(undefined)
                setSiteId('')
                setError('')
                setNotice('')
              }}
            />
          </PortfolioField>
          {mode === 'jira' ? (
            <>
              {sites.length > 1 && (
                <PortfolioSelect
                  label={translate('portfolio.jiraAccount', 'Jira account')}
                  value={siteId}
                  onChange={(value) => {
                    setSiteId(value)
                    onPreview(undefined)
                  }}
                  disabled={busy || pending}
                  options={sites.map((site) => ({
                    id: site.id,
                    name: `${site.displayName || site.email} · ${site.siteUrl}`
                  }))}
                />
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || pending || !url.trim()}
                onClick={() => void load()}
              >
                {pending
                  ? translate('portfolio.loadingTicket', 'Reading and drafting…')
                  : translate('portfolio.loadTicket', 'Read and fill draft')}
              </Button>
              <p className="text-xs text-muted-foreground">
                {translate(
                  'portfolio.jiraImportScope',
                  'Reads the ticket through your Jira connection, then fills the draft with AI. Custom fields, comments, and images are not included.'
                )}
              </p>
              {preview && (
                <div className="space-y-3 border-t border-border pt-3">
                  <p className="break-words text-sm font-medium">
                    {preview.key} · {preview.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {translate('portfolio.jiraSourceUpdated', 'Source updated: {{date}}', {
                      date: preview.updatedAt || '—'
                    })}
                  </p>
                  <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words font-sans text-sm scrollbar-sleek">
                    {preview.description ||
                      translate('portfolio.noTicketDescription', 'This ticket has no description.')}
                  </pre>
                  {preview.clipped && (
                    <p role="status" className="text-xs text-muted-foreground">
                      {translate(
                        'portfolio.jiraImportClipped',
                        'This preview was shortened to fit the form limits. Review the original ticket for omitted content.'
                      )}
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || pending || !url.trim()}
                onClick={() => void attachDesign()}
              >
                {pending
                  ? translate('portfolio.loadingTicket', 'Reading and drafting…')
                  : translate('portfolio.readDesignDraft', 'Read and fill draft')}
              </Button>
              <p className="text-xs text-muted-foreground">
                {translate(
                  'portfolio.designLinkScope',
                  'The agent attempts to read the shared page using its available tools. Only user-level MCP settings are available here; repository MCP settings are not loaded. Access failures are shown in the source report.'
                )}
              </p>
            </>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {disconnected && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || pending}
          onClick={() => {
            const store = useAppStore.getState()
            store.openSettingsTarget({
              pane: 'integrations',
              repoId: null,
              hostScope: { kind: 'local' }
            })
            store.openSettingsPage()
          }}
        >
          {translate('portfolio.openSettings', 'Open settings')}
        </Button>
      )}
      {notice && (
        <p role="status" className="text-xs text-muted-foreground">
          {notice}
        </p>
      )}
    </section>
  )
}
