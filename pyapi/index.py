"""
Python APIs
"""
import os
import json
import datetime
import traceback
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
import google.generativeai as genai
from google.cloud import storage
from compress_json import decompress
from bgpodcast.data_ingestion import nightscout as nsingest
from bgpodcast.prompt_generation import bgprompt
from bgpodcast.utils import bgutils, ssml
from bgpodcast.utils import objects
from bgpodcast.audio.gcloud import gen_podcast, get_job_status

app = FastAPI()

# Load templates from files
with open(os.path.join("app", "_prompts", "pass1.txt"), "r", encoding="utf-8") as f:
    template1 = f.read()
with open(os.path.join("app", "_prompts", "pass2.txt"), "r", encoding="utf-8") as f:
    template2 = f.read()
with open(os.path.join("app", "_prompts", "pass3.txt"), "r", encoding="utf-8") as f:
    template3 = f.read()


gemini_api_key = os.environ["GEMINI_API_KEY"]
# Constants
BUCKET_NAME = "goodnumbers"  # Replace with your bucket name
GCS_PATH = "audio-files"  # Folder in bucket to store audio files
POLLING_INTERVAL = 10  # seconds
TIMEOUT = 600  # 10 minutes


@app.post("/pyapi/get_notes")
async def get_notes(data: objects.NightscoutData):
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
        raise HTTPException(status_code=400, detail="Invalid JSON data") from e
    except Exception as e:
        print(f"Error generate_podcast: {e}")
        raise HTTPException(
            status_code=500, detail="Internal Server Error") from e

    return podcast_dialog


# @retry(wait=wait_random_exponential(multiplier=1, max=120))
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


@app.post("/pyapi/gen_podcast")
async def gen_podcast_api(dialog: objects.PodcastDialog) -> objects.PodcastGenerateResult:
    try:
        # Your existing podcast generation logic
        result = await gen_podcast(dialog)
        
        return result
    except Exception as e:
        return objects.PodcastGenerateResult(
            status="error",
            operation_id="",
            error=str(e)
        )

@app.post("/pyapi/check_podcast")
async def check_podcast_api(podcast_result: objects.PodcastGenerateResult) -> objects.PodcastGenerateResult:
    try:
        status = await get_job_status(podcast_result.operation_id)
        
        if status.done and not status.error:
            # # Generate signed URL when podcast is ready
            # storage_client = storage.Client()
            # bucket = storage_client.bucket(BUCKET_NAME)
            # blob = bucket.blob(podcast_result.gcs_path)  
            
            # url = blob.generate_signed_url(
            #     version="v4",
            #     expiration=datetime.timedelta(hours=1),
            #     method="GET",
            #     response_type="audio/mpeg",
            #     headers={
            #         "Access-Control-Allow-Origin": "*",
            #         "Cache-Control": "public, max-age=3600"
            #     }
            # )
            
            podcast_result.status = "done"
            # podcast_result.url = url

            return podcast_result
        if status.error:
            podcast_result.status = "error"
            podcast_result.error = str(status.error)
            return podcast_result
            
        else:
            podcast_result.status = "processing"
            podcast_result.error = str(status.error)
            
    except Exception as e:
        return objects.PodcastGenerateResult(
            status="error",
            operation_id=podcast_result.operation_id,
            error=str(e)
        )


@app.post("/pyapi/get_assessment")
async def get_assessment(data: objects.Assessment):
    """
    Get assessment
    """
    print("get_assessment started")
    # print(f"gemini_api_key: {gemini_api_key}")
    genai.configure(api_key=gemini_api_key)

    print(f"Notes: {data.notes[0:100]}")
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
        ssml_check : ssml.SSMLCheck = None

        if data.template_num == 1:
            print("Generating template 1")
            prompt = bgutils.interpolate(template1, notes=data.notes)
            print(f"Prompt1: {prompt}")
            if data.debug:
                response_text = bgutils.read_file(fr=os.path.join("_tmp", "pass1_output.txt")) 
            else:
                response = async_generate(prompt, model)
                response_text = response.text
            if data.write_local:
                bgutils.write_file(to=os.path.join("_tmp", "pass1_output.txt"), contents=response_text)
            print(f"Response1: {response_text[0:100]}")
            return JSONResponse({"valid": True, "response": response_text})
        elif data.template_num == 2:
            print("Generating template 2")
            prompt = bgutils.interpolate(
                template2, notes=data.notes, assessment1=data.assessment1)
            if data.debug:
                response_text = bgutils.read_file(fr=os.path.join("_tmp", "pass2_output.txt")) 
            else:
                response = async_generate(prompt, model)
                response_text = response.text
            if data.write_local:
                bgutils.write_file(to=os.path.join("_tmp", "pass2_output.txt"), contents=response_text)
            print(f"Response2: {response_text[0:100]}")
            return JSONResponse({"valid": True, "response": response_text})
        elif data.template_num == 3:
            print("Generating template 3")
            prompt = bgutils.interpolate(
                template3, notes=data.notes, assessment1=data.assessment1, assessment2=data.assessment2)
            generation_config["temperature"] = 1.5
            generation_config["max_output_tokens"] = 128000
            model = genai.GenerativeModel(
                model_name="gemini-1.5-pro",
                generation_config=generation_config,
            )
            is_valid_ssml = False
            no_ssml_tries = 0
            while not is_valid_ssml and no_ssml_tries < 3:
                print("Generating SSML")
                if data.debug:
                    response_text = bgutils.read_file(fr=os.path.join("_tmp", "pass3_output.txt")) 
                else:
                    response = async_generate(prompt, model)
                    response_text = response.text
                ssml_check  = ssml.check_google_tts_ssml_format(response_text)
                is_valid_ssml = ssml_check.is_correct
                print(f"Is valid SSML? {ssml_check.is_correct}")
                if not is_valid_ssml:
                    print(f"{no_ssml_tries}/3: Invalid SSML that couldn't be fixed: {response_text}")
                    if data.write_local:
                        bgutils.write_file(to=os.path.join("_tmp", "pass3_output.txt"), contents=response_text)
                    no_ssml_tries += 1
                else:
                    if data.write_local:
                        bgutils.write_file(to=os.path.join("_tmp", "pass3_output.txt"), contents=ssml_check.processed_ssml)
                    return JSONResponse({'valid' : True, 'response': ssml_check.processed_ssml})
        else:
            raise ValueError(f"Invalid template number: {data.template_num}")

        return JSONResponse({"valid": False, "ssml": response_text})

    except ValueError as ve:
        error_message = str(ve)
        print(f"ValueError: {error_message}")
        raise HTTPException(status_code=400, detail=error_message) from ve

    except Exception as e:
        error_message = f"An unexpected error occurred: {str(e)}"
        print(f"Unexpected Error: {error_message}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500, detail="Internal Server Error") from e


@app.get("/pyapi/test")
async def test():
    return JSONResponse({"response": "Working!"})

@app.post("/generate_podcast_url")
async def generate_podcast_url(file_path: str):
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket('goodnumbers')
        blob = bucket.blob(file_path)

        # Generate signed URL that expires in 1 hour
        url = blob.generate_signed_url(
            version="v4",
            expiration=datetime.timedelta(hours=1),
            method="GET",
            response_type="audio/mpeg",
            headers=None
        )
        
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    
@app.post("/pyapi/refresh_audio_url")
async def refresh_audio_url(request: objects.RefreshURLRequest) -> dict:
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(request.gcs_path)
        
        url = blob.generate_signed_url(
            version="v4",
            expiration=datetime.timedelta(hours=1),
            method="GET",
            response_type="audio/mpeg",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=3600"
            }
        )
        
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e