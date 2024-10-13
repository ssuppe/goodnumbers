# """
# Generate clinical notes
# """

# # from io import BytesIO
# from http import HTTPStatus
# import pandas as pd
# from bgpodcast.data_ingestion import nightscout as nsingest
# from bgpodcast.prompt_generation import bgprompt

# def get_notes(treatments : pd.DataFrame, carbs : pd.DataFrame):
#     podcast_dialog = ""
#     # Process the data (replace with your actual logic)
#     try :

#         treatments = nsingest.load_sgv_json(data.treatments)
#         carbs = nsingest.load_carb_json(data.carbs)

#         notes = None
#         notes = bgprompt.generate_notes("Steve", "male", treatments, carbs)
#         # Call LLM for first pass
#         # assessment1 = bgprompt.call_llm(model="gemini-1.5-pro", prompt_filename="prompts/pass1.txt", notes=notes)
#         # assessment2 = bgprompt.call_llm(model="gemini-1.5-pro", prompt_filename="prompts/pass2.txt", notes=notes, assessment1=assessment1)
#         # podcast_dialog = bgprompt.call_llm(model="gemini-1.5-pro", prompt_filename="prompts/pass3.txt", notes=notes, assessment1=assessment1, assessment2=assessment2)
#         podcast_dialog = notes
#     except Exception as e:
#         print(f"Error generate_podcast: {e.args}")
#         print(e)
#         raise e

#     return podcast_dialog

