import React, { useState, useEffect } from 'react';
import { FileSystemService } from '../lib/fileSystem/FileSystemService';

const fs = new FileSystemService();

export function DebugFS() {
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Idle');

  useEffect(() => {
    async function init() {
      try {
        const persisted = await fs.loadPersistedWorkspace();
        if (persisted) {
          setHandle(persisted);
          setStatus('Workspace loaded from persistence (needs unlock)');
        }
      } catch (err: any) {
        setError(err.message);
      }
    }
    init();
  }, []);

  const handleSelect = async () => {
    try {
      setError(null);
      const h = await fs.selectWorkspace();
      setHandle(h);
      setStatus('Workspace selected and persisted');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUnlock = async () => {
    if (!handle) return;
    try {
      setError(null);
      const granted = await fs.verifyPermission(handle);
      if (granted) {
        setStatus('Workspace unlocked (Read/Write granted)');
      } else {
        setStatus('Permission denied');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleTestWrite = async () => {
    if (!handle) return;
    try {
      setError(null);
      const fileHandle = await handle.getFileHandle('debug-test.txt', { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(`Debug write at ${new Date().toISOString()}`);
      await writable.close();
      setStatus('Successfully wrote debug-test.txt');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleClear = async () => {
    await fs.clearWorkspace();
    setHandle(null);
    setStatus('Workspace cleared');
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '20px', borderRadius: '8px' }}>
      <h3>FileSystem Debug Tools</h3>
      <p><strong>Status:</strong> {status}</p>
      {error && <p style={{ color: 'red' }}><strong>Error:</strong> {error}</p>}
      
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={handleSelect}>Select Workspace</button>
        {handle && <button onClick={handleUnlock}>Unlock Workspace</button>}
        {handle && <button onClick={handleTestWrite}>Test Write</button>}
        {handle && <button onClick={handleClear} style={{ color: 'red' }}>Clear Workspace</button>}
      </div>

      {handle && (
        <div style={{ marginTop: '10px', fontSize: '0.9em' }}>
          <strong>Current Workspace:</strong> {handle.name}
        </div>
      )}
    </div>
  );
}
