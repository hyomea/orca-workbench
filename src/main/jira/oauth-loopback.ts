import { createServer, type Server } from 'node:http'
import { timingSafeEqual } from 'node:crypto'

export async function listenForJiraOAuth(
  callbackUrl: string,
  state: string,
  receive: (code: string | null) => void
): Promise<Server> {
  const callback = new URL(callbackUrl)
  let consumed = false
  const server = createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader('Content-Type', 'text/plain; charset=utf-8')
    const url = new URL(request.url ?? '/', callback.origin)
    const received = Buffer.from(url.searchParams.get('state') ?? '')
    const expected = Buffer.from(state)
    if (
      consumed ||
      request.method !== 'GET' ||
      url.pathname !== callback.pathname ||
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      response.writeHead(400).end('Invalid authorization callback. Return to Orca Workbench.')
      return
    }
    consumed = true
    const code = url.searchParams.get('error') ? null : url.searchParams.get('code')
    response.end('Authorization received. Return to Orca Workbench to finish connecting.')
    server.close()
    receive(code)
  })
  server.requestTimeout = 10000
  server.headersTimeout = 10000
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(Number(callback.port), '127.0.0.1', () => {
      server.removeListener('error', reject)
      resolve()
    })
  })
  return server
}
