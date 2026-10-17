import { Capacitor, CapacitorHttp } from '@capacitor/core';
export interface SyncRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}
export interface SyncResponse {
  status: number;
  body: string;
}
export type SyncRequester = (request: SyncRequest) => Promise<SyncResponse>;
export const syncRequest: SyncRequester = async (request) => {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return (await window.electronAPI.serviceChannel.call({
      serviceName: 'syncHttpService',
      method: 'request',
      args: [request],
    })) as SyncResponse;
  }
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.request({
      url: request.url,
      method: request.method,
      headers: request.headers,
      data: request.body,
      responseType: 'text',
      connectTimeout: 30000,
      readTimeout: 30000,
      disableRedirects: true,
    });
    const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    if (body.length > 50_000_000) throw new Error('Sync response exceeds 50 MB.');
    return { status: response.status, body };
  }
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    signal: AbortSignal.timeout(30000),
    redirect: 'error',
    credentials: 'omit',
  });
  if (Number(response.headers.get('content-length')) > 50_000_000) throw new Error('Sync response exceeds 50 MB.');
  const body = await response.text();
  if (body.length > 50_000_000) throw new Error('Sync response exceeds 50 MB.');
  return { status: response.status, body };
};
