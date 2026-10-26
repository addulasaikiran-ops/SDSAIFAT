export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/api/run') {
      if (request.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } })
      }

      if (!env.JUDGE0_API_URL) {
        return Response.json({ error: 'Java runner is not configured. Add JUDGE0_API_URL to your Cloudflare Worker secrets/variables.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
      }

      let body
      try {
        body = await request.json()
      } catch {
        return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
      }

      if (typeof body?.source_code !== 'string' || body.source_code.length < 1 || body.source_code.length > 50000) {
        return Response.json({ error: 'source_code must be a non-empty string under 50 KB.' }, { status: 400 })
      }
      if (body.stdin !== undefined && typeof body.stdin !== 'string') {
        return Response.json({ error: 'stdin must be a string.' }, { status: 400 })
      }

      try {
        const base = env.JUDGE0_API_URL.trim().replace(/\/$/, '')
        const submitUrl = new URL(base)
        const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
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
          return Response.json({ error: 'Execution provider rejected the request.', detail }, { status: upstream.status >= 500 ? 502 : upstream.status, headers: { 'Cache-Control': 'no-store' } })
        }

        let result = await upstream.json()
        if (result.token && (!result.status || typeof result.status.id !== 'number' || result.status.id <= 2)) {
          const pollUrl = new URL(base + '/' + encodeURIComponent(result.token))
          pollUrl.searchParams.set('base64_encoded', 'false')
          for (let i = 0; i < 12; i++) {
            await new Promise((resolve) => setTimeout(resolve, 750))
            const poll = await fetch(pollUrl, { headers, signal: AbortSignal.timeout(5000) })
            if (!poll.ok) return Response.json({ error: 'Could not retrieve the execution result.' }, { status: 502 })
            result = await poll.json()
            if (typeof result.status?.id === 'number' && result.status.id > 2) break
          }
        }

        if (result.token && (!result.status || typeof result.status.id !== 'number' || result.status.id <= 2)) {
          return Response.json({ error: 'Execution timed out while waiting for the Judge0 result. Try again.' }, { status: 504 })
        }

        return Response.json({
          stdout: result.stdout ?? null,
          stderr: result.stderr ?? null,
          compile_output: result.compile_output ?? null,
          message: result.message ?? null,
          status: result.status ?? null,
          time: result.time ?? null,
          memory: result.memory ?? null,
        }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
      } catch {
        return Response.json({ error: 'Could not reach the Java execution provider. Check the Judge0 URL and availability.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
      }
    }

    return env.ASSETS.fetch(request)
  },
}
