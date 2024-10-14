"""
Python APIs
"""
from typing import Optional
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from google.generativeai import GenerativeModel
import os

from bgpodcast.data_ingestion import nightscout as nsingest
from bgpodcast.prompt_generation import bgprompt

# Load templates from files
with open(os.path.join("app", "_prompts", "pass1.txt"), "r", encoding="utf-8") as f:
    template1 = f.read()
with open(os.path.join("app", "_prompts", "pass2.txt"), "r", encoding="utf-8") as f:
    template2 = f.read()
with open(os.path.join("app", "_prompts", "pass3.txt"), "r", encoding="utf-8") as f:
    template3 = f.read()

### Create FastAPI instance with custom docs and openapi url
app = FastAPI()

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
        # treatments = nsingest.load_sgv_json(data.treatments)
        # carbs = nsingest.load_carb_json(data.carbs)
        print(f"Treatments: {data.treatments}")
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

@app.post("/pyapi/get_assessment")
async def get_assessment(notes : str = None, assessment1 : str = None, assessment2 : str = None, template_num : int = 1):
    try:
        gemini_key = os.getenv("GEMINI_API_KEY")
        if not gemini_key:
            raise ValueError("GEMINI_API_KEY environment variable is not defined!")

        generation_config = {
            "temperature": 1.0,
            "top_p": 0.95,
            "top_k": 64,
            "max_output_tokens": 32000,
            "response_mime_type": "text/plain",
        }

        model = GenerativeModel(
            model_name="gemini-1.5-pro",
            api_key=gemini_key,
            generation_config=generation_config,
        )

        # data = await request.json()
        # notes = data.get("notes")
        # assessment1 = data.get("assessment1")
        # assessment2 = data.get("assessment2")
        # template_num = data.get("template_num")

        if not template_num:
            raise ValueError("Missing 'template_num' in request body")

        response_text = ""

        if template_num == 1:
            prompt = template1.format(notes=notes)
            response = model.generate_text(prompt)
            response_text = response.text
        elif template_num == 2:
            prompt = template2.format(notes=notes, assessment1=assessment1)
            response = model.generate_text(prompt)
            response_text = response.text
        elif template_num == 3:
            prompt = template3.format(
                notes=notes, assessment1=assessment1, assessment2=assessment2
            )
            generation_config["temperature"] = 1.5
            generation_config["max_output_tokens"] = 128000
            model = GenerativeModel(
                model_name="gemini-1.5-pro",
                api_key=gemini_key,
                generation_config=generation_config,
            )
            response = model.generate_text(prompt)
            response_text = response.text
        else:
            raise ValueError(f"Invalid template number: {template_num}")

        return JSONResponse({"response": response_text})

    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail="Internal Server Error")
