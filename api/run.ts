declare const process: { env: Record<string, string | undefined> }

type Judge0Result = {
  token?: string
  stdout?: string | null
  stderr?: string | null
  compile_output?: string | null
  message?: string | null
  time?: string | null
  memory?: number | null
  status?: { id?: number; description?: string }
}

function send(res: { status: (code: number) => { json: (body: unknown) => void }; setHeader: (name: string, value: string) => void }, code: number, body: unknown) {
  res.setHeader('Cache-Control', 'no-store')
  res.status(code).json(body)
}

export default async function handler(
  req: { method?: string; body?: unknown; headers: Record<string, string | string[] | undefined> },
  res: { status: (code: number) => { json: (body: unknown) => void }; setHeader: (name: string, value: string) => void },
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return send(res, 405, { error: 'Method not allowed' })
  }

  const judge0Url = process.env.JUDGE0_API_URL?.trim()
  if (!judge0Url) return send(res, 503, { error: 'Java runner is not configured. Set JUDGE0_API_URL in your deployment environment.' })

  const body = req.body as { source_code?: unknown; stdin?: unknown } | undefined
  if (typeof body?.source_code !== 'string' || body.source_code.length < 1 || body.source_code.length > 50000) {
    return send(res, 400, { error: 'source_code must be a non-empty string under 50 KB.' })
  }
  if (typeof body.stdin !== 'undefined' && typeof body.stdin !== 'string') {
    return send(res, 400, { error: 'stdin must be a string.' })
  }

  const apiKey = process.env.JUDGE0_API_KEY
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (apiKey) {
    headers['X-RapidAPI-Key'] = apiKey
    headers['X-RapidAPI-Host'] = new URL(judge0Url).host
  }

  try {
    const base = judge0Url.replace(/\/$/, '')
    const submitUrl = new URL(base)
    submitUrl.searchParams.set('base64_encoded', 'false')
    submitUrl.searchParams.set('wait', 'true')
    const upstream = await fetch(submitUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        language_id: 62,
        source_code: body.source_code,
        stdin: body.stdin ?? '',
        cpu_time_limit: 2,
        wall_time_limit: 5,
      }),
      signal: AbortSignal.timeout(10000),
    })
    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 1000)
      return send(res, upstream.status >= 500 ? 502 : upstream.status, { error: 'Execution provider rejected the request.', detail })
    }

    let result = await upstream.json() as Judge0Result
    if (result.token && (!result.status || typeof result.status.id !== 'number' || result.status.id <= 2)) {
      const pollUrl = new URL(base + '/' + encodeURIComponent(result.token))
      pollUrl.searchParams.set('base64_encoded', 'false')
      for (let i = 0; i < 12; i++) {
        await new Promise((resolve) => setTimeout(resolve, 750))
        const poll = await fetch(pollUrl, { headers, signal: AbortSignal.timeout(5000) })
        if (!poll.ok) return send(res, 502, { error: 'Could not retrieve the execution result.' })
        result = await poll.json() as Judge0Result
        if (typeof result.status?.id === 'number' && result.status.id > 2) break
      }
    }

    if (result.token && (!result.status || typeof result.status.id !== 'number' || result.status.id <= 2)) {
      return send(res, 504, { error: 'Execution timed out while waiting for the Judge0 result. Try again.' })
    }
    return send(res, 200, {
      stdout: result.stdout ?? null,
      stderr: result.stderr ?? null,
      compile_output: result.compile_output ?? null,
      message: result.message ?? null,
      status: result.status ?? null,
      time: result.time ?? null,
      memory: result.memory ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown execution error'
    return send(res, 502, { error: 'Could not reach the Java execution provider.', detail: message })
  }
}
