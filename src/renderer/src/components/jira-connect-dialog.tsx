import { useState } from 'react'
import { useAppStore } from '@/store'
import {
  getProviderRuntimeContextKey,
  isEnvironmentRuntimeContextKey
} from '@/runtime/hosts/observations/provider-runtime-context'
import { JiraTokenConnectDialog, type JiraConnectDialogProps } from './jira-token-connect-dialog'
import { JiraOAuthConnectDialog } from './jira-oauth-connect-dialog'

export function JiraConnectDialog(props: JiraConnectDialogProps): React.JSX.Element {
  const settings = useAppStore((state) => state.settings)
  const [tokenMode, setTokenMode] = useState(false)
  const remote = isEnvironmentRuntimeContextKey(getProviderRuntimeContextKey(settings))
  const onOpenChange = (open: boolean): void => {
    if (!open) {
      setTokenMode(false)
    }
    props.onOpenChange(open)
  }
  return remote || tokenMode ? (
    <JiraTokenConnectDialog {...props} onOpenChange={onOpenChange} />
  ) : (
    <JiraOAuthConnectDialog
      {...props}
      onOpenChange={onOpenChange}
      onTokenMode={() => setTokenMode(true)}
    />
  )
}
