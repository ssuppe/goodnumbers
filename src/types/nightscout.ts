export interface PodcastGenerateResult {
    status: string;
    operation_id?: string;
    url?: string;
    error?: string;
    gcs_path?: string;
    bucket_name?: string;
  }

export interface AssessmentData {
  notes: string;
  assessment1: string;
  assessment2: string;
  dialog: string;
  podcastResult: PodcastGenerateResult;
  timestamp : string | null;
}

export interface InitialStoredData {
  notes: string | null;
  assessment1: string | null;
  assessment2: string | null;
  dialog: string | null;
  podcastResult: PodcastGenerateResult | null;
  timestamp : string | null;
}
