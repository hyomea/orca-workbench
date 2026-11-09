import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { createNonSecureContextUuid as createBrowserUuid } from '../../../shared/non-secure-context-uuid'
import {
  JiraOAuthConfiguration,
  JiraOAuthProgress,
  JiraOAuthStarted
} from '../../../shared/jira/jira-oauth'

const rpc = (method: string, params?: unknown) =>
  callRuntimeRpc({ kind: 'local' }, method, params, { timeoutMs: 45000 })
export function useJiraOAuth(onConnected: () => void) {
  const [config, setConfig] = useState<z.infer<typeof JiraOAuthConfiguration> | null>(null)
  const [progress, setProgress] = useState<JiraOAuthProgress | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [requestId, setRequestId] = useState('')
  const active = useRef<string | null>(null)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    void rpc('jira.oauthConfiguration')
      .then((result) => {
        if (mounted.current) {
          setConfig(JiraOAuthConfiguration.parse(result))
        }
      })
      .catch((failure) => {
        if (mounted.current) {
          setError(String(failure))
        }
      })
    return () => {
      mounted.current = false
      if (active.current) {
        void rpc('jira.oauthCancel', { requestId: active.current }).catch(() => {})
      }
      active.current = null
    }
  }, [])
  useEffect(() => {
    if (!requestId) {
      return
    }
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    async function poll(): Promise<void> {
      try {
        const result = JiraOAuthProgress.parse(await rpc('jira.oauthProgress', { requestId }))
        if (disposed || active.current !== requestId) {
          return
        }
        setProgress(result)
        if (result.phase === 'error') {
          setError(result.error ?? 'Jira authorization failed.')
        } else {
          timer = setTimeout(() => void poll(), 1000)
        }
      } catch (failure) {
        if (!disposed && active.current === requestId) {
          setError(failure instanceof Error ? failure.message : String(failure))
        }
      }
    }
    void poll()
    return () => {
      disposed = true
      clearTimeout(timer)
    }
  }, [requestId])
  async function configure(clientId: string, clientSecret: string): Promise<boolean> {
    setPending(true)
    setError('')
    try {
      await rpc('jira.oauthConfigure', { clientId, clientSecret })
      const result = JiraOAuthConfiguration.parse(await rpc('jira.oauthConfiguration'))
      if (mounted.current) {
        setConfig(result)
      }
      return true
    } catch (failure) {
      if (mounted.current) {
        setError(failure instanceof Error ? failure.message : String(failure))
      }
      return false
    } finally {
      if (mounted.current) {
        setPending(false)
      }
    }
  }
  async function begin(): Promise<void> {
    if (active.current) {
      return
    }
    setPending(true)
    setError('')
    const id = createBrowserUuid()
    active.current = id
    try {
      const result = JiraOAuthStarted.parse(await rpc('jira.oauthBegin', { requestId: id }))
      if (!mounted.current || active.current !== id) {
        await rpc('jira.oauthCancel', { requestId: id })
        return
      }
      const url = new URL(result.authorizationUrl)
      if (url.origin !== 'https://auth.atlassian.com' || url.pathname !== '/authorize') {
        throw new Error('Invalid Atlassian authorization URL.')
      }
      await window.api.shell.openUrl(url.href)
      if (!mounted.current || active.current !== id) {
        await rpc('jira.oauthCancel', { requestId: id })
        return
      }
      setRequestId(id)
      setProgress({ phase: 'waiting', sites: [] })
    } catch (failure) {
      await rpc('jira.oauthCancel', { requestId: id }).catch(() => {})
      active.current = null
      if (mounted.current) {
        setError(failure instanceof Error ? failure.message : String(failure))
      }
    } finally {
      if (mounted.current) {
        setPending(false)
      }
    }
  }
  async function cancel(): Promise<void> {
    const id = active.current
    active.current = null
    setRequestId('')
    setProgress(null)
    setError('')
    if (id) {
      await rpc('jira.oauthCancel', { requestId: id }).catch((failure) => {
        if (mounted.current) {
          setError(String(failure))
        }
      })
    }
  }
  async function complete(cloudId: string): Promise<void> {
    const id = active.current
    if (!id) {
      return
    }
    setPending(true)
    setError('')
    try {
      const result = z
        .object({ ok: z.literal(true), siteId: z.string() })
        .parse(await rpc('jira.oauthComplete', { requestId: id, cloudId }))
      if (result.ok && mounted.current && active.current === id) {
        active.current = null
        setRequestId('')
        onConnected()
      }
    } catch (failure) {
      if (mounted.current) {
        setError(failure instanceof Error ? failure.message : String(failure))
      }
    } finally {
      if (mounted.current) {
        setPending(false)
      }
    }
  }
  return { config, progress, pending, error, requestId, configure, begin, cancel, complete }
}
