import type { SyncRequest, SyncResponse } from '../still/syncRequest';
// Native networking avoids renderer CORS restrictions without disabling web security.
export class SyncHttpService {
  async request(request: SyncRequest): Promise<SyncResponse> {
    const url = new URL(request.url);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Sync requires HTTPS.');
    if (!['GET', 'PUT', 'DELETE', 'PROPFIND', 'MKCOL', 'POST'].includes(request.method))
      throw new Error('Unsupported sync method.');
    if ((request.body?.length || 0) > 50_000_000) throw new Error('Sync upload exceeds 50 MB.');
    const response = await fetch(url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
    });
    let body = '';
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let size = 0;
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 50_000_000) throw new Error('Sync response exceeds 50 MB.');
          body += decoder.decode(chunk.value, { stream: true });
        }
        body += decoder.decode();
      } finally {
        await reader.cancel();
      }
    }
    return { status: response.status, body };
  }
}
