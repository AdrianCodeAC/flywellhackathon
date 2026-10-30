/** Public-source diagnostics shared by browser-safe and server-only service helpers. */
export async function loggedFetch(url: string, init?: RequestInit, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const start = Date.now();
  const target = new URL(url, "https://arrival-assistant.local");
  try {
    const response = await fetchImpl(url, init);
    console.info(`[Arrival HTTP] ${target.host}${target.pathname} status=${response.status} ${Date.now() - start}ms`);
    return response;
  } catch (error) {
    console.error(`[Arrival HTTP] ${target.host}${target.pathname} status=NETWORK_ERROR ${Date.now() - start}ms`);
    throw error;
  }
}