/**
 * Next.js route handler that forwards a simple test payload to the Forge web trigger.
 *
 * This keeps the server-side integration intentionally small and explicit so it is easy to
 * understand how a Next.js backend can invoke the Forge webhook without involving browser code.
 */
export async function POST() {
  try {
    /**
     * Send a payload that matches the structure expected by the Forge webhook.
     *
     * The non-null assertion is used here because this setup step assumes the environment variable
     * will be configured before the endpoint is exercised.
     */
    const response = await fetch(process.env.CONFLUENCE_DOCS_WEBHOOK_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'nextjs-app',
        eventType: 'feature-update',
        timestamp: new Date().toISOString(),
        data: {
          message: 'Test from Next.js',
        },
      }),
    });

    const data = await response.json();

    return Response.json({
      ok: true,
      forgeResponse: data,
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
