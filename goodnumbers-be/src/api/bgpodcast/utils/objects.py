from pydantic import BaseModel


class PodcastGenerateResult(BaseModel):
    status: str  # "processing", "done", "error"
    operation_id: str
    url: str | None = None  # Signed URL when ready
    error: str | None = None
    gcs_path: str | None = None  # Keep internal GCS info
    bucket_name: str | None = None
    title: str | None = None
    description: str | None = None


class Assessment(BaseModel):
    valid: bool | None = False
    notes: str | None = None
    assessment1: str | None = None
    assessment2: str | None = None
    title: str | None = None
    description: str | None = None
    ssml_dialog: str | None = None
    template_num: int | None = 1
    timestamp: str | None = None
    id: str
    podcastResult: PodcastGenerateResult | None = None


class NightscoutData(BaseModel):
    entries: list
    treatments: list


class PodcastAudioURL:
    audio_url: str | None = None


class JobCheckResponse(BaseModel):
    name: str | None = None
    done: bool
    metadata: dict | None = None
    status: str | None = None
    message: dict | None = None
    error: dict | None = None
    result: dict | None = None


class RefreshURLRequest(BaseModel):
    gcs_path: str
