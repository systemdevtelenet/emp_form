export function hasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const requestHost = request.headers.get("host") || requestUrl.host;
    return originUrl.host === requestHost && originUrl.protocol === requestUrl.protocol;
  } catch {
    return false;
  }
}
