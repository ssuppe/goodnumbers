from pydantic import BaseModel

class Assessment(BaseModel):
    notes: str | None = None
    assessment1: str | None = None
    assessment2: str | None = None
    template_num: int | None = 1
    debug: bool = True
    offline : bool = True
    write_local : bool = True

class NightscoutData(BaseModel):
    entries: list
    treatments: list

class PodcastDialog(BaseModel):
    dialog: str | None = None
    
class PodcastAudioURL:
    audio_url: str | None = None
    
class JobCheckResponse(BaseModel):
    name : str | None = None
    done : bool
    metadata : dict | None = None
    status : str | None = None
    message : dict | None = None
    error : dict | None = None
    result : dict | None = None

class PodcastGenerateResult(BaseModel):
    status: str  # "processing", "done", "error"
    operation_id: str
    url: str | None = None  # Signed URL when ready
    error: str | None = None
    gcs_path: str | None = None  # Keep internal GCS info
    bucket_name: str | None = None

class RefreshURLRequest(BaseModel):
    gcs_path: str
    
