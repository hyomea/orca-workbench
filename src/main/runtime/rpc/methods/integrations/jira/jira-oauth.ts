import {
  JiraOAuthConfigure,
  JiraOAuthRequest,
  JiraOAuthComplete
} from '../../../../../../shared/rpc-contract/jira-params'
import {
  configureJiraOAuthApp,
  jiraOAuthConfiguration
} from '../../../../../jira/oauth-credentials'
import {
  beginJiraOAuth,
  cancelJiraOAuth,
  readJiraOAuthProgress,
  completeJiraOAuth
} from '../../../../../jira/oauth-flow'
import { defineMethod, type RpcContext } from '../../../core'

function desktopOwner(context: RpcContext): string {
  if (context.caller?.kind !== 'desktop' || context.pairedDeviceId) {
    throw new Error(
      'Jira browser sign-in is available in the local desktop app. Remote hosts can use API tokens.'
    )
  }
  return `desktop:${context.connectionId ?? 'local'}`
}
export const JIRA_OAUTH_METHODS = [
  defineMethod({
    name: 'jira.oauthConfiguration',
    permission: 'accounts-admin',
    params: null,
    handler: (_params, context) => {
      desktopOwner(context)
      return jiraOAuthConfiguration()
    }
  }),
  defineMethod({
    name: 'jira.oauthConfigure',
    permission: 'accounts-admin',
    params: JiraOAuthConfigure,
    handler: (params, context) => {
      desktopOwner(context)
      configureJiraOAuthApp(params)
      return { ok: true }
    }
  }),
  defineMethod({
    name: 'jira.oauthBegin',
    permission: 'accounts-admin',
    params: JiraOAuthRequest,
    handler: (params, context) => beginJiraOAuth(desktopOwner(context), params.requestId)
  }),
  defineMethod({
    name: 'jira.oauthProgress',
    permission: 'accounts-admin',
    params: JiraOAuthRequest,
    handler: (params, context) => readJiraOAuthProgress(desktopOwner(context), params.requestId)
  }),
  defineMethod({
    name: 'jira.oauthCancel',
    permission: 'accounts-admin',
    params: JiraOAuthRequest,
    handler: (params, context) => {
      cancelJiraOAuth(desktopOwner(context), params.requestId)
      return { ok: true }
    }
  }),
  defineMethod({
    name: 'jira.oauthComplete',
    permission: 'accounts-admin',
    params: JiraOAuthComplete,
    handler: (params, context) =>
      completeJiraOAuth(desktopOwner(context), params.requestId, params.cloudId)
  })
]
