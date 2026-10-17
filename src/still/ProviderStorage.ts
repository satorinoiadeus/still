import type { IDatabaseStorage } from '@/services/database/common/database';
import type { ISelfhostedSyncServerConfig } from '@/services/selfhostedSync/common/selfhostedSyncService';
import { openSnapshot, sealSnapshot } from './syncCrypto';
import { syncRequest, SyncRequester } from './syncRequest';
// Path normalization and Dropbox error classification adapted from Mindwtr's
// packages/core/src/dropbox-sync-utils.ts, AGPL-3.0-only. See THIRD-PARTY-NOTICES.md.
export const resolveDropboxPath = (path: string): string => {
  const trimmed = path.trim();
  if (!trimmed) throw new Error('Dropbox path is required');
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};
export const isDropboxPathNotFoundTag = (tag: string): boolean =>
  tag === 'path/not_found' || tag === 'path_lookup/not_found';
const validKey = (key: string) => /^still-v1-[0-9a-f-]{36}\.hbSync$/.test(key);
const xmlText = (text: string) =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
export class ProviderStorage implements IDatabaseStorage {
  readonly id: string;
  private base: string;
  constructor(
    private config: ISelfhostedSyncServerConfig,
    private request: SyncRequester = syncRequest
  ) {
    this.id = config.id;
    if (!config.passphrase || config.passphrase.length < 12)
      throw new Error('Use an encryption passphrase of at least 12 characters on every device.');
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(config.folder))
      throw new Error('Use a folder name containing letters, numbers, hyphens or underscores.');
    if (config.type === 'webdav') {
      const url = new URL(config.entrypoint);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
        throw new Error('WebDAV requires an HTTPS collection URL without embedded credentials, query or fragment.');
      this.base = url.href.replace(/\/$/, '') + '/' + config.folder + '/';
    } else {
      this.base = resolveDropboxPath(config.folder);
    }
  }
  private async dav(method: string, key = '', body?: string) {
    const credentials = new TextEncoder().encode(`${this.config.username || ''}:${this.config.authToken}`);
    const auth = btoa(Array.from(credentials, (c) => String.fromCharCode(c)).join(''));
    return this.request({
      url: this.base + key,
      method,
      body,
      headers: {
        Authorization: `Basic ${auth}`,
        ...(method === 'PROPFIND'
          ? { Depth: '1', 'Content-Type': 'application/xml' }
          : { 'Content-Type': 'application/octet-stream' }),
        ...(method === 'PUT' ? { 'If-None-Match': '*' } : {}),
      },
    });
  }
  private async dropbox(endpoint: string, args: object, content?: string) {
    const contentEndpoint = endpoint === 'upload' || endpoint === 'download';
    return this.request({
      url: `https://${contentEndpoint ? 'content' : 'api'}.dropboxapi.com/2/files/${endpoint}`,
      method: 'POST',
      body: contentEndpoint ? content : JSON.stringify(args),
      headers: {
        Authorization: `Bearer ${this.config.authToken}`,
        ...(contentEndpoint
          ? {
              'Dropbox-API-Arg': JSON.stringify(args).replace(
                /[\u007f-\uffff]/g,
                (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')
              ),
              'Content-Type': 'application/octet-stream',
            }
          : { 'Content-Type': 'application/json' }),
      },
    });
  }
  private check(status: number, operation: string) {
    if (status < 200 || status >= 300)
      throw new Error(
        `${this.config.type} ${operation} failed (HTTP ${status}). Check URL, credentials and permissions.`
      );
  }
  async list(): Promise<string[]> {
    if (this.config.type === 'webdav') {
      let result = await this.dav(
        'PROPFIND',
        '',
        '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>'
      );
      if (result.status === 404) {
        const mkdir = await this.dav('MKCOL');
        this.check(mkdir.status, 'create folder');
        result = await this.dav('PROPFIND');
      }
      this.check(result.status, 'list');
      if (!/<(?:\w+:)?multistatus[\s>]/i.test(result.body))
        throw new Error('WebDAV did not return a DAV collection listing.');
      const keys: string[] = [];
      for (const match of result.body.matchAll(/<(?:\w+:)?href[^>]*>([\s\S]*?)<\/(?:\w+:)?href>/gi)) {
        const url = new URL(xmlText(match[1].trim()), this.base);
        const name = decodeURIComponent(url.pathname.split('/').pop() || '');
        if (validKey(name) && url.href === this.base + name) keys.push(name);
      }
      if (keys.length > 1000) throw new Error('Too many sync snapshots; choose a dedicated Still folder.');
      return [...new Set(keys)];
    }
    let result = await this.dropbox('list_folder', { path: this.base, recursive: false });
    if (result.status === 409) {
      const error = JSON.parse(result.body);
      const summary = String(error.error_summary || '')
        .split('/')
        .slice(0, 2)
        .join('/');
      if (isDropboxPathNotFoundTag(summary)) {
        const mkdir = await this.dropbox('create_folder_v2', { path: this.base, autorename: false });
        this.check(mkdir.status, 'create folder');
        result = await this.dropbox('list_folder', { path: this.base, recursive: false });
      }
    }
    const keys: string[] = [];
    for (let page = 0; ; page++) {
      this.check(result.status, 'list');
      const data = JSON.parse(result.body);
      if (!Array.isArray(data.entries)) throw new Error('Invalid Dropbox listing.');
      for (const entry of data.entries)
        if (entry['.tag'] === 'file' && typeof entry.name === 'string' && validKey(entry.name)) keys.push(entry.name);
      if (keys.length > 1000 || page > 100) throw new Error('Too many Dropbox snapshots.');
      if (!data.has_more) return keys;
      if (typeof data.cursor !== 'string') throw new Error('Missing Dropbox pagination cursor.');
      result = await this.dropbox('list_folder/continue', { cursor: data.cursor });
    }
  }
  async read(key: string) {
    if (!validKey(key)) throw new Error('Invalid sync filename.');
    const result =
      this.config.type === 'webdav'
        ? await this.dav('GET', key)
        : await this.dropbox('download', { path: `${this.base}/${key}` });
    this.check(result.status, 'read');
    return openSnapshot(result.body, this.config.passphrase!);
  }
  async save(content: string) {
    const key = `still-v1-${crypto.randomUUID()}.hbSync`;
    const body = await sealSnapshot(content, this.config.passphrase!);
    const result =
      this.config.type === 'webdav'
        ? await this.dav('PUT', key, body)
        : await this.dropbox(
            'upload',
            { path: `${this.base}/${key}`, mode: 'add', autorename: false, mute: true },
            body
          );
    this.check(result.status, 'write');
    return key;
  }
  async delete(key: string) {
    if (!validKey(key)) throw new Error('Invalid sync filename.');
    const result =
      this.config.type === 'webdav'
        ? await this.dav('DELETE', key)
        : await this.dropbox('delete_v2', { path: `${this.base}/${key}` });
    if (result.status !== 404) this.check(result.status, 'delete');
  }
}
