export type SyncStatus = 'synced' | 'pending_push' | 'pending_delete';

export interface JournalMetadata {
  id: string;
  date: string;
  name: string;
  syncStatus: SyncStatus;
  lastModified: string; // ISO string
}

export interface JournalEntry extends JournalMetadata {
  content: string; // The full markdown content (frontmatter + body)
  githubSha?: string; // GitHub file SHA for updates
}

export interface IJournalRepository {
  /**
   * Lists all journal entries in local storage.
   */
  listJournals(): Promise<JournalMetadata[]>;

  /**
   * Retrieves a full journal entry by its ID.
   */
  getJournal(id: string): Promise<JournalEntry | undefined>;

  /**
   * Saves a journal entry locally (sets status to pending_push).
   */
  saveJournal(journal: Omit<JournalEntry, 'syncStatus' | 'lastModified'>): Promise<void>;

  /**
   * Deletes a journal entry locally (sets status to pending_delete).
   */
  deleteJournal(id: string): Promise<void>;

  /**
   * Updates the sync status of an entry after a successful remote sync.
   */
  updateSyncStatus(id: string, status: SyncStatus, githubSha?: string): Promise<void>;
}
