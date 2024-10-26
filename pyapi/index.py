"""
Python APIs
"""
import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import google.generativeai as genai
import google.cloud.texttospeech as tts
from google.api_core import client_options
from compress_json import decompress
from tenacity import retry, wait_random_exponential
from bgpodcast.data_ingestion import nightscout as nsingest
from bgpodcast.prompt_generation import bgprompt
from bgpodcast.utils import bgutils


# Load templates from files
with open(os.path.join("app", "_prompts", "pass1.txt"), "r", encoding="utf-8") as f:
    template1 = f.read()
with open(os.path.join("app", "_prompts", "pass2.txt"), "r", encoding="utf-8") as f:
    template2 = f.read()
with open(os.path.join("app", "_prompts", "pass3.txt"), "r", encoding="utf-8") as f:
    template3 = f.read()


gemini_api_key = os.environ["GEMINI_API_KEY"]
app = FastAPI()

class Data(BaseModel):
    treatments: list
    carbs: list

@app.post("/pyapi/get_notes")
async def get_notes(data: Data):
    """
    Create manual notes
    """
    data.treatments = decompress(data.treatments)
    data.carbs = decompress(data.carbs)
    
    print("get_notes")
    podcast_dialog = ""
    try:
        print("Reading treatments and carbs")
        treatments = nsingest.load_sgv_dict(data.treatments)
        carbs = nsingest.load_carb_dict(data.carbs)
        notes = None
        notes = bgprompt.generate_notes("Steve", "male", treatments, carbs)
        podcast_dialog = notes
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON data")
    except Exception as e:
        print(f"Error generate_podcast: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

    return podcast_dialog

class Assessment(BaseModel):
    notes : str | None = None
    assessment1 : str | None = None
    assessment2 : str | None = None
    template_num : int | None = 1


@retry(wait=wait_random_exponential(multiplier=1, max=120))
async def async_generate(prompt, model):
    """
    Generate
    """
    print("generating")
    response = await model.generate_content_async(
        prompt,
        stream=False
    )
    print("done")
    return response

@app.post("/pyapi/get_assessment")
async def get_assessment(data : Assessment):
    """
    Get assessment
    """
    print("get_assessment started")
    # print(f"gemini_api_key: {gemini_api_key}")
    genai.configure(api_key=gemini_api_key)

    print(f"Notes {data.notes}")
    try:
        generation_config = {
            "temperature": 1.0,
            "top_p": 0.95,
            "top_k": 64,
            "max_output_tokens": 32000,
            "response_mime_type": "text/plain",
        }

        model = genai.GenerativeModel(
            model_name="gemini-1.5-pro",
            generation_config=generation_config,
        )

        if not data.template_num:
            raise ValueError("Missing 'template_num' in request body")

        response_text = ""

        if data.template_num == 1:
            # print(f"Template1: {template1}")
            prompt = bgutils.interpolate(template1, notes=data.notes)
            print(f"Prompt1: {prompt}")
            response = await async_generate(prompt, model)
            # response = await model.generate_content_async(prompt, request_options=RequestOptions(
            #                             retry=retry_async.AsyncRetry(
            #                                 initial=10,
            #                                 multiplier=2,
            #                                 maximum=60,
            #                                 timeout=180
            #                             )
            #                            ))       
            response_text = response.text
            print(f"Response1: {response_text[0:100]}")
        elif data.template_num == 2:
            # print(f"Template2: {template2}")
            prompt = bgutils.interpolate(template2, notes=data.notes, assessment1=data.assessment1)
            # response = await model.generate_content_async(prompt, request_options=RequestOptions(
            #                             retry=retry_async.AsyncRetry(
            #                                 initial=10,
            #                                 multiplier=2,
            #                                 maximum=60,
            #                                 timeout=300
            #                             )
            #                            ))
            response = await async_generate(prompt, model)
            response_text = response.text
            print(f"Response2: {response_text[0:100]}")
        elif data.template_num == 3:
            # print(f"Template3: {template3}")
            prompt = bgutils.interpolate(template3, notes=data.notes, assessment1=data.assessment1, assessment2=data.assessment2)
            generation_config["temperature"] = 1.5
            generation_config["max_output_tokens"] = 128000
            model = genai.GenerativeModel(
                model_name="gemini-1.5-pro",
                generation_config=generation_config,
            )

            response = await async_generate(prompt, model)
            response_text = response.text
            print(f"Response3: {response_text[0:100]}")
        else:
            raise ValueError(f"Invalid template number: {data.template_num}")

        return JSONResponse({"response": response_text})

    except ValueError as ve:
        error_message = str(ve)
        print(f"ValueError: {error_message}")
        raise HTTPException(status_code=400, detail=error_message) 

    except Exception as e:
        error_message = f"An unexpected error occurred: {str(e)}"
        print(f"Unexpected Error: {error_message}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

class PodcastDialog(BaseModel):
    dialog : str | None = None

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import google.cloud.texttospeech as tts
from google.api_core import client_options
from google.cloud import storage
import os
import time
import asyncio
from datetime import datetime

app = FastAPI()

# Constants
BUCKET_NAME = "your-bucket-name"  # Replace with your bucket name
GCS_PATH = "audio-files"  # Folder in bucket to store audio files
POLLING_INTERVAL = 10  # seconds
TIMEOUT = 600  # 10 minutes

class PodcastDialog(BaseModel):
    dialog: str | None = None

@app.post("/pyapi/gen_podcast")
async def gen_podcast(dialog: PodcastDialog):
    """
    Generate long-form audio from SSML using Google Cloud Text-to-Speech.
    
    Args:
        dialog: PodcastDialog object containing SSML markup
    
    Returns:
        Dictionary containing operation ID and GCS path information
    
    Raises:
        ValueError: If dialog is empty or invalid
        HTTPException: For various Google API errors
    """
    if dialog is None or dialog.dialog is None or dialog.dialog == "":
        raise ValueError(f"Invalid dialog: {dialog.dialog}")

    try:
        # Initialize Storage client
        storage_client = storage.Client()
        bucket = storage_client.bucket(BUCKET_NAME)

        # Generate unique file path
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        file_name = f"podcast_{timestamp}.mp3"
        gcs_path = f"{GCS_PATH}/{file_name}"
        output_gcs_uri = f"gs://{BUCKET_NAME}/{gcs_path}"

        # Initialize Text-to-Speech client with specific endpoint
        client_opts = client_options.ClientOptions(
            api_endpoint='texttospeech.googleapis.com:443'
        )

        async with tts.TextToSpeechLongAudioSynthesizeAsyncClient(
            client_options=client_opts
        ) as client:
            # Start the long audio synthesis operation
            operation = await client.synthesize_long_audio(
                request=tts.SynthesizeLongAudioRequest(
                    input=tts.SynthesisInput(ssml=dialog.dialog),
                    voice=tts.VoiceSelectionParams(
                        language_code="en-US",
                        name="en-G-Wavenet-B"  # Using your specific voice
                    ),
                    audio_config=tts.AudioConfig(
                        audio_encoding=tts.AudioEncoding.MP3
                    ),
                    output_gcs_uri=output_gcs_uri
                )
            )

            return {
                "status": "processing",
                "operation_id": operation.operation.name,
                "gcs_path": gcs_path,
                "bucket_name": BUCKET_NAME,
                "message": "Audio generation started successfully"
            }

    except Exception as e:
        print(f"Error in gen_podcast: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))    

@app.get("/pyapi/test")
async def test():
    return JSONResponse({"response": "Working!"})