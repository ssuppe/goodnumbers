"""
Python APIs
"""
import os
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict
import google.generativeai as genai
from google.generativeai.types import RequestOptions
# from google.api_core import retry
from google.api_core import retry_async
from bgpodcast.data_ingestion import nightscout as nsingest
from bgpodcast.prompt_generation import bgprompt
from bgpodcast.utils import bgutils

class Settings(BaseSettings):
    gemini_api_key: str
    pythonpath: str
    model_config = SettingsConfigDict(env_file=".env.development")

# Load templates from files
with open(os.path.join("app", "_prompts", "pass1.txt"), "r", encoding="utf-8") as f:
    template1 = f.read()
with open(os.path.join("app", "_prompts", "pass2.txt"), "r", encoding="utf-8") as f:
    template2 = f.read()
with open(os.path.join("app", "_prompts", "pass3.txt"), "r", encoding="utf-8") as f:
    template3 = f.read()

settings = Settings()
app = FastAPI()

genai.configure(api_key=settings.gemini_api_key)

class NightscoutData(BaseModel):
    """
    Nightscout
    """
    treatments: Optional[str] = None
    carbs: Optional[str] = None

@app.post("/pyapi/get_notes")
async def get_analysis(data: NightscoutData):
    """
    Create manual notes
    """
    podcast_dialog = ""
    # Process the data (replace with your actual logic)
    try :
        # print(f"Treatments: {data.treatments}")
        if data.treatments is None:
            treatments = nsingest.load_entries_data("24Sept.30d", "24Sept.30d")
            carbs = nsingest.load_carb_data("24Sept.30d", "24Sept.30d")
        else:
            treatments = nsingest.load_sgv_json(data.treatments)
            carbs = nsingest.load_carb_json(data.carbs)
        notes = None
        notes = bgprompt.generate_notes("Steve", "male", treatments, carbs)
        # Call LLM for first pass
        # assessment1 = bgprompt.call_llm(model="gemini-1.5-pro", prompt_filename="prompts/pass1.txt", notes=notes)
        # assessment2 = bgprompt.call_llm(model="gemini-1.5-pro", prompt_filename="prompts/pass2.txt", notes=notes, assessment1=assessment1)
        # podcast_dialog = bgprompt.call_llm(model="gemini-1.5-pro", prompt_filename="prompts/pass3.txt", notes=notes, assessment1=assessment1, assessment2=assessment2)
        podcast_dialog = notes
    except Exception as e:
        print(f"Error generate_podcast: {e.args}")
        print(e)
        raise e

    return podcast_dialog

class Assessment(BaseModel):
    notes : str | None = None
    assessment1 : str | None = None
    assessment2 : str | None = None
    template_num : int | None = 1

@app.post("/pyapi/get_assessment")
async def get_assessment(data : Assessment):
    """
    Get assessment
    """
    print("get_assessment started")
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
            # print(f"Prompt1: {prompt}")
            response = await model.generate_content_async(prompt, request_options=RequestOptions(
                                        retry=retry_async.AsyncRetry(
                                            initial=10, 
                                            multiplier=2, 
                                            maximum=60, 
                                            timeout=300
                                        )
                                       ))         
            response_text = response.text
            print(f"Response1: {response_text[0:100]}")
        elif data.template_num == 2:
            # print(f"Template2: {template2}")
            prompt = bgutils.interpolate(template2, notes=data.notes, assessment1=data.assessment1)
            response = await model.generate_content_async(prompt, request_options=RequestOptions(
                                        retry=retry_async.AsyncRetry(
                                            initial=10, 
                                            multiplier=2, 
                                            maximum=60, 
                                            timeout=300
                                        )
                                       ))
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
            response = await model.generate_content_async(prompt, request_options=RequestOptions(
                                        retry=retry_async.AsyncRetry(
                                            initial=10, 
                                            multiplier=2, 
                                            maximum=60, 
                                            timeout=300
                                        )
                                       ))
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