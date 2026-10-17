import React, { useState } from 'react';
import { useService } from '@/hooks/use-service';
import { useWatchEvent } from '@/hooks/use-watch-event';
import { ISelfhostedSyncService } from '@/services/selfhostedSync/common/selfhostedSyncService';
export function SyncOptions() {
  const sync = useService(ISelfhostedSyncService);
  useWatchEvent(sync.onStateChange);
  const [provider, setProvider] = useState<'webdav' | 'dropbox'>('webdav');
  const [endpoint, setEndpoint] = useState('');
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [folder, setFolder] = useState('Still');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  if (!sync.enabled) return null;
  if (sync.hasServer)
    return message ? (
      <p role="status" className="px-4 py-3 text-sm">
        {message}
      </p>
    ) : null;
  return (
    <form
      className="still-sync"
      aria-label="Additional sync providers"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage('Checking connection…');
        try {
          await sync.addServer({
            type: provider,
            entrypoint: endpoint,
            username,
            authToken: token,
            passphrase,
            folder,
          });
          setToken('');
          setPassphrase('');
          await sync.sync();
          setMessage('Connected and synced.');
        } catch (error) {
          setMessage((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>More ways to sync</h3>
      <p>
        WebDAV and Dropbox options inspired by Mindwtr. They sync Still snapshots, using Still’s existing merge engine.
        They do not read or modify Mindwtr data.
      </p>
      <label>
        Provider{' '}
        <select
          aria-label="Sync provider"
          value={provider}
          onChange={(event) => setProvider(event.target.value as typeof provider)}
        >
          <option value="webdav">WebDAV (Nextcloud, ownCloud…)</option>
          <option value="dropbox">Dropbox</option>
        </select>
      </label>
      {provider === 'webdav' && (
        <>
          <label>
            HTTPS collection URL{' '}
            <input
              type="url"
              required
              value={endpoint}
              onChange={(event) => setEndpoint(event.target.value)}
              placeholder="https://cloud.example/remote.php/dav/files/you"
            />
          </label>
          <label>
            Username{' '}
            <input
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
        </>
      )}
      <label>
        {provider === 'webdav' ? 'App password' : 'Dropbox access token'}{' '}
        <input
          type="password"
          autoComplete="off"
          required
          value={token}
          onChange={(event) => setToken(event.target.value)}
        />
      </label>
      {provider === 'dropbox' && (
        <p>
          Use your own Dropbox app token with files.content.read, files.content.write and files.metadata.read scopes.
          Tokens expire according to your Dropbox app settings; reconnect when needed.
        </p>
      )}
      <label>
        Dedicated Still folder{' '}
        <input
          required
          pattern="[a-zA-Z0-9_-]{1,80}"
          value={folder}
          onChange={(event) => setFolder(event.target.value)}
        />
      </label>
      <label>
        Encryption passphrase{' '}
        <input
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
        />
      </label>
      <p>
        Use the same provider, folder and passphrase on each device. Keep the passphrase safe: it cannot be recovered.
        Credentials and passphrase are stored in this device’s settings, outside task backups. Web builds require
        provider CORS support; installed apps use native networking.
      </p>
      <button disabled={busy} type="submit">
        {busy ? 'Connecting…' : 'Connect and sync'}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
