import { defineFixture } from '../component-fixtures/component-fixture'
import { JIRA_OAUTH_CALLBACK } from '../../../shared/jira/jira-oauth'
import { JiraOAuthConnectDialog } from './jira-oauth-connect-dialog'

function fixture(configured: boolean, width: number) {
  return defineFixture({
    width,
    setup() {
      window.api.runtime.call = async () => ({
        id: 'fixture',
        _meta: { runtimeId: 'fixture' },
        ok: true,
        result: {
          configured,
          clientId: configured ? 'example-app' : undefined,
          callbackUrl: JIRA_OAUTH_CALLBACK,
          protection: 'sealed'
        }
      })
    },
    render: () => <JiraOAuthConnectDialog open onOpenChange={() => {}} onTokenMode={() => {}} />
  })
}
export const setup = fixture(false, 560)
export const ready = fixture(true, 560)
export const narrow = fixture(false, 360)

function authorizedFixture(multiple: boolean) {
  const base = fixture(true, 560)
  return defineFixture({
    ...base,
    setup() {
      base.setup?.()
      const configuration = window.api.runtime.call
      window.api.shell.openUrl = async () => {}
      window.api.runtime.call = async (args) => {
        const site = {
          id: 'ludus',
          name: 'Ludus',
          url: 'https://ludus.atlassian.net',
          scopes: ['read:jira-work', 'read:jira-user']
        }
        if (args.method === 'jira.oauthConfiguration') {
          return configuration(args)
        }
        return {
          id: 'fixture',
          _meta: { runtimeId: 'fixture' },
          ok: true,
          result:
            args.method === 'jira.oauthBegin'
              ? { authorizationUrl: 'https://auth.atlassian.com/authorize' }
              : {
                  phase: 'choose-site',
                  sites: multiple
                    ? [
                        site,
                        {
                          ...site,
                          id: 'studio',
                          name: 'Studio',
                          url: 'https://studio.atlassian.net'
                        }
                      ]
                    : [site]
                }
        }
      }
    },
    async interact() {
      for (let i = 0; i < 100; i++) {
        const button = Array.from(document.querySelectorAll('button')).find(
          (entry) => entry.textContent === 'Sign in with Atlassian'
        )
        if (button && !button.disabled) {
          button.click()
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
      for (let i = 0; i < 100; i++) {
        if (document.body.textContent?.includes('Finish connecting Jira')) {
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
      throw new Error('Authorization fixture did not reach site selection')
    }
  })
}
export const authorized = authorizedFixture(false)
export const multipleSites = authorizedFixture(true)
