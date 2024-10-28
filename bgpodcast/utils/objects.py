from pydantic import BaseModel

def foo():
    return "foo"

class Assessment(BaseModel):
    notes: str | None = None
    assessment1: str | None = None
    assessment2: str | None = None
    template_num: int | None = 1

class NightscoutData(BaseModel):
    treatments: list
    carbs: list

class PodcastDialog(BaseModel):
    dialog: str | None = None
    
class PodcastAudioURL:
    audio_url: str | None = None
    
class JobCheck(BaseModel):
    operation: str
    
class JobCheckResponse(BaseModel):
    name : str | None = None
    done : bool
    metadata : dict | None = None
    status : str | None = None
    message : dict | None = None
    error : dict | None = None
    result : dict | None = None

class PodcastGenerateResult(BaseModel):
    status: str
    operation_id: str
    gcs_path : str
    bucket_name : str
    message: str | None = ""
    