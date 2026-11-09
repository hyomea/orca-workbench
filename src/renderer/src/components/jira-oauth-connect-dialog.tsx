import { useId, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { beginJiraMutation } from '@/store/slices/jira/jira-read-coordination'
import { JIRA_OAUTH_CALLBACK } from '../../../shared/jira/jira-oauth'
import { useJiraOAuth } from './use-jira-oauth'
import type { JiraConnectDialogProps } from './jira-token-connect-dialog'

type Props = JiraConnectDialogProps & { onTokenMode: () => void }
export function JiraOAuthConnectDialog(props: Props): React.JSX.Element | null {
  return props.open ? <Connection {...props} /> : null
}
function Connection({
  onOpenChange,
  onConnected,
  onTokenMode,
  overlayClassName,
  contentClassName
}: Props): React.JSX.Element {
  const flow = useJiraOAuth(() => {
    beginJiraMutation()
    void useAppStore.getState().checkJiraConnection()
    onOpenChange(false)
    onConnected?.()
  })
  const [clientId, setClientId] = useState('')
  const [secret, setSecret] = useState('')
  const [setup, setSetup] = useState(false)
  const [siteId, setSiteId] = useState('')
  const id = useId()
  const active = !!flow.requestId
  const configuring = !!flow.config && (!flow.config.configured || setup)
  const sites = flow.progress?.sites ?? []
  const selectedSiteId = sites.some((site) => site.id === siteId)
    ? siteId
    : sites.length === 1
      ? sites[0].id
      : ''
  const choosingSite = flow.progress?.phase === 'choose-site'
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !flow.pending) {
          onOpenChange(false)
        }
      }}
    >
      <DialogContent
        surface="security"
        scrollable
        overlayClassName={overlayClassName}
        className={contentClassName}
      >
        <DialogHeader>
          <DialogTitle>
            {choosingSite
              ? translate('jira.oauth.finishTitle', 'Finish connecting Jira')
              : translate('jira.oauth.title', 'Connect with Atlassian')}
          </DialogTitle>
          <DialogDescription>
            {choosingSite
              ? sites.length === 1
                ? translate(
                    'jira.oauth.singleSiteReady',
                    'Atlassian authorization received. Your Jira site is selected below. Click Connect selected site to finish.'
                  )
                : translate(
                    'jira.oauth.sitesReady',
                    'Atlassian authorization received. Choose a Jira site below, then click Connect selected site to finish.'
                  )
              : translate(
                  'jira.oauth.description',
                  'Sign in in your browser, authorize read access, then choose a Jira site. No personal API token is needed.'
                )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!flow.config && !flow.error && (
            <p className="text-sm text-muted-foreground">
              {translate('jira.oauth.loading', 'Checking connection setup…')}
            </p>
          )}
          {configuring && (
            <section className="space-y-3 rounded-md border border-border p-3">
              <p className="text-sm font-medium">
                {translate('jira.oauth.setupTitle', 'One-time setup for this local Workbench')}
              </p>
              <p className="text-xs text-muted-foreground">
                {translate(
                  'jira.oauth.setupDescription',
                  'Register an OAuth 2.0 integration in the Atlassian Developer Console. Add Jira API classic scopes read:jira-work and read:jira-user, and use this exact callback URL:'
                )}
              </p>
              <p className="break-all font-mono text-xs">{JIRA_OAUTH_CALLBACK}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  void window.api.shell.openUrl('https://developer.atlassian.com/console/myapps/')
                }
              >
                {translate('jira.oauth.openConsole', 'Open Developer Console')}
              </Button>
              <div className="space-y-2">
                <Label htmlFor={`${id}-client`}>
                  {translate('jira.oauth.clientId', 'Client ID')}
                </Label>
                <Input
                  id={`${id}-client`}
                  autoComplete="off"
                  value={clientId}
                  onChange={(event) => setClientId(event.target.value)}
                  disabled={flow.pending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-secret`}>
                  {translate('jira.oauth.clientSecret', 'Client secret')}
                </Label>
                <Input
                  id={`${id}-secret`}
                  type="password"
                  autoComplete="off"
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  disabled={flow.pending}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {translate(
                  'jira.oauth.localSecret',
                  'These application credentials stay in local credential storage. Never include the secret in a distributed desktop build.'
                )}
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={flow.pending || !clientId.trim() || !secret.trim()}
                onClick={() =>
                  void flow.configure(clientId, secret).then((saved) => {
                    if (saved) {
                      setSecret('')
                      setSetup(false)
                    }
                  })
                }
              >
                {translate('jira.oauth.saveSetup', 'Save application setup')}
              </Button>
            </section>
          )}
          {flow.config?.protection === 'plaintext' && (
            <p className="text-xs text-muted-foreground">
              {translate(
                'jira.oauth.plaintext',
                'OS encryption is unavailable; credentials are stored in owner-restricted local files.'
              )}
            </p>
          )}
          {flow.progress && (
            <div className="space-y-3" aria-live="polite">
              {['waiting', 'exchanging', 'connecting'].includes(flow.progress.phase) && (
                <p className="flex items-center gap-2 text-sm">
                  <Loader2 className="size-4 animate-spin" />
                  {flow.progress.phase === 'waiting'
                    ? translate('jira.oauth.waiting', 'Finish signing in in your browser…')
                    : translate('jira.oauth.verifying', 'Verifying Atlassian access…')}
                </p>
              )}
              {flow.progress.phase === 'choose-site' && (
                <div className="space-y-2">
                  <Label htmlFor={`${id}-site`}>
                    {translate('jira.oauth.site', 'Authorized Jira site')}
                  </Label>
                  <Select value={selectedSiteId} onValueChange={setSiteId} disabled={flow.pending}>
                    <SelectTrigger id={`${id}-site`} className="w-full min-w-0">
                      <SelectValue
                        placeholder={translate('jira.oauth.chooseSite', 'Choose a site')}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {flow.progress.sites.map((site) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.name} · {site.url}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {translate(
                      'jira.oauth.readOnly',
                      'This connection reads Jira issues and imports their context. It does not grant permission to edit Jira issues.'
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
          {flow.error && (
            <p role="alert" className="text-sm text-destructive">
              {flow.error}
            </p>
          )}
          {!active && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="link"
                size="sm"
                disabled={flow.pending}
                onClick={onTokenMode}
              >
                {translate('jira.oauth.useToken', 'Use API token or self-hosted Jira')}
              </Button>
              {flow.config?.configured && !setup && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={flow.pending}
                  onClick={() => {
                    setClientId(flow.config?.clientId ?? '')
                    setSetup(true)
                  }}
                >
                  {translate('jira.oauth.changeSetup', 'Application setup')}
                </Button>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          {!active && (
            <Button
              type="button"
              variant="ghost"
              disabled={flow.pending}
              onClick={() => onOpenChange(false)}
            >
              {translate('jira.oauth.close', 'Close')}
            </Button>
          )}
          {active ? (
            <>
              <Button
                type="button"
                variant="ghost"
                disabled={flow.pending}
                onClick={() => void flow.cancel().then(() => setSiteId(''))}
              >
                {translate('jira.oauth.cancel', 'Cancel sign-in')}
              </Button>
              {flow.progress?.phase === 'choose-site' && (
                <Button
                  disabled={flow.pending || !selectedSiteId}
                  onClick={() => void flow.complete(selectedSiteId)}
                >
                  {translate('jira.oauth.connectSite', 'Connect selected site')}
                </Button>
              )}
            </>
          ) : (
            <Button
              disabled={flow.pending || !flow.config?.configured || configuring}
              onClick={() => void flow.begin()}
            >
              {translate('jira.oauth.browserLogin', 'Sign in with Atlassian')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
