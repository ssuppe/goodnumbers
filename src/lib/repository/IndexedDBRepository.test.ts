import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IndexedDBRepository } from './IndexedDBRepository';
import { openDB, deleteDB } from 'idb';

const DB_NAME = 'test_journals_db';

describe('IndexedDBRepository', () => {
  let repository: IndexedDBRepository;

  beforeEach(async () => {
    repository = new IndexedDBRepository(DB_NAME);
  });

  afterEach(async () => {
    await deleteDB(DB_NAME);
  });

  it('should save and list journals', async () => {
    const entry = {
      id: 'uuid-1',
      date: '2026-03-11',
      name: '2026-03-11-journal.md',
      content: 'hello',
    };

    await repository.saveJournal(entry);

    const journals = await repository.listJournals();
    expect(journals).toHaveLength(1);
    expect(journals[0].id).toBe('uuid-1');
    expect(journals[0].syncStatus).toBe('pending_push');
  });

  it('should get a journal entry by ID', async () => {
    const entry = {
      id: 'uuid-1',
      date: '2026-03-11',
      name: '2026-03-11-journal.md',
      content: 'hello',
    };

    await repository.saveJournal(entry);
    const retrieved = await repository.getJournal('uuid-1');
    expect(retrieved?.content).toBe('hello');
  });

  it('should update sync status', async () => {
    const entry = {
      id: 'uuid-1',
      date: '2026-03-11',
      name: '2026-03-11-journal.md',
      content: 'hello',
    };

    await repository.saveJournal(entry);
    await repository.updateSyncStatus('uuid-1', 'synced', 'new-sha');

    const retrieved = await repository.getJournal('uuid-1');
    expect(retrieved?.syncStatus).toBe('synced');
    expect(retrieved?.githubSha).toBe('new-sha');
  });

  it('should mark as pending_delete instead of physical delete', async () => {
    const entry = {
      id: 'uuid-1',
      date: '2026-03-11',
      name: '2026-03-11-journal.md',
      content: 'hello',
    };

    await repository.saveJournal(entry);
    await repository.deleteJournal('uuid-1');

    const journals = await repository.listJournals();
    // It should still be in the DB but with pending_delete status
    expect(journals).toHaveLength(1);
    expect(journals[0].syncStatus).toBe('pending_delete');
  });
});
