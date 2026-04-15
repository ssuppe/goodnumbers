import { Octokit } from '@octokit/rest';

export interface GitHubCredentials {
  owner: string;
  repo: string;
  token: string;
}

export class GitHubSyncService {
  private octokit: Octokit;

  constructor(private credentials: GitHubCredentials) {
    this.octokit = new Octokit({
      auth: credentials.token,
    });
  }

  /**
   * Verifies if the GitHub PAT is valid and has access to the user profile.
   */
  async verifyCredentials(): Promise<boolean> {
    try {
      const { status } = await this.octokit.rest.users.getAuthenticated();
      return status === 200;
    } catch (err) {
      return false;
    }
  }

  /**
   * Pushes a file to GitHub.
   * If `sha` is provided, it updates an existing file.
   */
  async pushFile(path: string, content: string, message: string, sha?: string) {
    // btoa is available in modern browsers for base64 encoding
    const encodedContent = btoa(unescape(encodeURIComponent(content)));
    
    const response = await this.octokit.rest.repos.createOrUpdateFileContents({
      owner: this.credentials.owner,
      repo: this.credentials.repo,
      path,
      message,
      content: encodedContent,
      sha,
    });

    return {
      sha: response.data.content?.sha,
    };
  }

  /**
   * Retrieves a file content from GitHub.
   */
  async getFile(path: string): Promise<string> {
    const { data }: any = await this.octokit.rest.repos.getContent({
      owner: this.credentials.owner,
      repo: this.credentials.repo,
      path,
    });

    if (Array.isArray(data)) {
      throw new Error('Path is a directory, not a file');
    }

    if (data.encoding === 'base64') {
      return decodeURIComponent(escape(atob(data.content)));
    }

    return data.content;
  }

  /**
   * Retrieves the full tree of the repository to detect remote changes.
   */
  async getTree(branch = 'main') {
    const response = await this.octokit.rest.git.getTree({
      owner: this.credentials.owner,
      repo: this.credentials.repo,
      tree_sha: branch,
      recursive: '1',
    });

    return response.data.tree;
  }
}
