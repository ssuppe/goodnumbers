// export interface PodcastInfo {
//   valid: boolean;
//   title: string;
//   description: string;
//   ssml_dialog: string;
//   id: string;
// }

export interface PodcastGenerateResult {
  status: string;
  operation_id?: string;
  url: string;
  error?: string;
  gcs_path?: string;
  bucket_name?: string;
  title?: string;
  description?: string;
}

export interface AssessmentData {
  valid?: boolean | null;
  notes?: string | null;
  assessment1?: string | null;
  assessment2?: string | null;
  title?: string | null;
  description?: string | null;
  ssml_dialog?: string | null;
  template_num?: number | 1;
  timestamp?: string | null;
  id?: string | null;
  podcastResult?: PodcastGenerateResult | null;
}

export interface InitialStoredData {
  notes: string | null;
  assessment1: string | null;
  assessment2: string | null;
  dialog: string | null;
  podcastResult: PodcastGenerateResult | null;
  timestamp: string | null;
}
