import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubSyncService } from './GitHubSyncService';
import { Octokit } from '@octokit/rest';

// Mock Octokit
vi.mock('@octokit/rest', () => {
  const Octokit = vi.fn().mockImplementation(() => ({
    rest: {
      users: {
        getAuthenticated: vi.fn(),
      },
      repos: {
        getContent: vi.fn(),
        createOrUpdateFileContents: vi.fn(),
      },
      git: {
        getTree: vi.fn(),
      },
    },
  }));
  return { Octokit };
});

describe('GitHubSyncService', () => {
  let service: GitHubSyncService;
  let mockOctokit: any;

  const credentials = {
    owner: 'test-user',
    repo: 'test-repo',
    token: 'test-token',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitHubSyncService(credentials);
    mockOctokit = (Octokit as any).mock.results[0].value;
  });

  it('should verify credentials', async () => {
    mockOctokit.rest.users.getAuthenticated.mockResolvedValue({ status: 200 });
    
    const isValid = await service.verifyCredentials();
    expect(isValid).toBe(true);
    expect(mockOctokit.rest.users.getAuthenticated).toHaveBeenCalled();
  });

  it('should push a new file to GitHub', async () => {
    mockOctokit.rest.repos.createOrUpdateFileContents.mockResolvedValue({
      data: {
        content: { sha: 'new-sha' }
      }
    });

    const result = await service.pushFile('entries/2026-03-11.md', 'file content', 'commit message');
    
    expect(result.sha).toBe('new-sha');
    expect(mockOctokit.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
      owner: credentials.owner,
      repo: credentials.repo,
      path: 'entries/2026-03-11.md',
      message: 'commit message',
      content: btoa('file content'), // Octokit expects base64
    });
  });

  it('should update an existing file on GitHub with SHA', async () => {
    mockOctokit.rest.repos.createOrUpdateFileContents.mockResolvedValue({
      data: {
        content: { sha: 'updated-sha' }
      }
    });

    const result = await service.pushFile(
      'entries/2026-03-11.md', 
      'updated content', 
      'update message', 
      'old-sha'
    );
    
    expect(result.sha).toBe('updated-sha');
    expect(mockOctokit.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(expect.objectContaining({
      sha: 'old-sha'
    }));
  });

  it('should fetch a file content from GitHub', async () => {
    mockOctokit.rest.repos.getContent.mockResolvedValue({
      data: {
        content: btoa('retrieved content'),
        encoding: 'base64'
      }
    });

    const content = await service.getFile('entries/test.md');
    expect(content).toBe('retrieved content');
  });
});
