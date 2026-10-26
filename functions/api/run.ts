interface Env {
  JUDGE0_API_URL?: string
  JUDGE0_API_KEY?: string
}

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

type PagesContext = {
  request: Request
  env: Env
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export async function onRequest({ request, env }: PagesContext): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const judge0Url = env.JUDGE0_API_URL?.trim()
  if (!judge0Url) {
    return json({ error: 'Java runner is not configured. Add JUDGE0_API_URL to your Cloudflare Pages environment variables.' }, 503)
  }

  let body: { source_code?: unknown; stdin?: unknown }
  try {
    body = await request.json() as { source_code?: unknown; stdin?: unknown }
  } catch {
    return json({ error: 'Request body must be valid JSON.' }, 400)
  }

  if (typeof body.source_code !== 'string' || body.source_code.length < 1 || body.source_code.length > 50000) {
    return json({ error: 'source_code must be a non-empty string under 50 KB.' }, 400)
  }
  if (typeof body.stdin !== 'undefined' && typeof body.stdin !== 'string') {
    return json({ error: 'stdin must be a string.' }, 400)
  }

  try {
    const base = judge0Url.replace(/\/$/, '')
    const submitUrl = new URL(base)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
    if (env.JUDGE0_API_KEY) {
      headers['X-RapidAPI-Key'] = env.JUDGE0_API_KEY
      headers['X-RapidAPI-Host'] = submitUrl.host
    }
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
      return json({ error: 'Execution provider rejected the request.', detail }, upstream.status >= 500 ? 502 : upstream.status)
    }

    let result = await upstream.json() as Judge0Result
    if (result.token && (!result.status || typeof result.status.id !== 'number' || result.status.id <= 2)) {
      const pollUrl = new URL(base + '/' + encodeURIComponent(result.token))
      pollUrl.searchParams.set('base64_encoded', 'false')
      for (let i = 0; i < 12; i++) {
        await new Promise((resolve) => setTimeout(resolve, 750))
        const poll = await fetch(pollUrl, { headers, signal: AbortSignal.timeout(5000) })
        if (!poll.ok) return json({ error: 'Could not retrieve the execution result.' }, 502)
        result = await poll.json() as Judge0Result
        if (typeof result.status?.id === 'number' && result.status.id > 2) break
      }
    }

    if (result.token && (!result.status || typeof result.status.id !== 'number' || result.status.id <= 2)) {
      return json({ error: 'Execution timed out while waiting for the Judge0 result. Try again.' }, 504)
    }

    return json({
      stdout: result.stdout ?? null,
      stderr: result.stderr ?? null,
      compile_output: result.compile_output ?? null,
      message: result.message ?? null,
      status: result.status ?? null,
      time: result.time ?? null,
      memory: result.memory ?? null,
    })
  } catch {
    return json({ error: 'Could not reach the Java execution provider. Check the Judge0 URL and availability.' }, 502)
  }
}
