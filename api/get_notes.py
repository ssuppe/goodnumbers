from http import HTTPStatus
import json
from typing import Dict, Any

def GET(request: Dict[str, Any]) -> Dict[str, Any]:
    # Replace this with your actual logic to get notes
    notes = [
        {"id": 1, "content": "First note"},
        {"id": 2, "content": "Second note"}
    ]
    return {
        'status': HTTPStatus.OK,
        'body': json.dumps(notes)
    }

# """
# Generate clinical notes
# """

# from http.server import BaseHTTPRequestHandler
# from io import BytesIO
# from http import HTTPStatus
# import sys
# import os

# print("This message should appear in the logs if loaded correctly")

# # Get the absolute path of the current file
# current_file_path = os.path.abspath(__file__)

# # Get the directory containing the current file
# current_dir = os.path.dirname(current_file_path)

# # Get the project root directory (two levels up from the current directory)
# project_root = os.path.abspath(os.path.join(current_dir, "..", ".."))

# # Add the project root directory to the Python path
# sys.path.append(project_root)

# # Now you can import from your local package
# from bgpodcast.data_ingestion import nightscout as nsingest
# from bgpodcast.prompt_generation import bgprompt

# class handler(BaseHTTPRequestHandler):

#     def do_GET(self):
#         self.send_response(200)
#         self.send_header('Content-type', 'text/plain')
#         self.end_headers()
#         text = "Hello world"
#         self.wfile.write(text.encode())
#         return

#     # def generate_podcast(sgv : pd.DataFrame, treatments : pd.DataFrame):
#     def do_POST(self, req, res):
#         """
#         Generate notes
#         """
#         if req.method != 'POST':
#             res.status_code = HTTPStatus.METHOD_NOT_ALLOWED
#             res.headers = {"Content-Type": "text/plain"}
#             return BytesIO(b"Method Not Allowed")
            
#         podcast_dialog = ""
#         # Process the data (replace with your actual logic)
#         try :

#             # --- Get POST Data ---
#             data = req.json  # Assuming JSON data in the request body

#             # Convert data to pandas DataFrames (ensure pandas is installed)
#             # sgv_df = pd.DataFrame(data.get('sgv'))
#             # treatments_df = pd.DataFrame(data.get('treatments'))

#             sgv = nsingest.load_sgv_json(data.get('sgv'))
#             treatments = nsingest.load_carb_json(data.get('treatments'))

#             notes = None
#             notes = bgprompt.generate_notes("Steve", "male", sgv, treatments)
#             # Call LLM for first pass
#             # assessment1 = bgprompt.call_llm(model="gemini-1.5-pro", prompt_filename="prompts/pass1.txt", notes=notes)
#             # assessment2 = bgprompt.call_llm(model="gemini-1.5-pro", prompt_filename="prompts/pass2.txt", notes=notes, assessment1=assessment1)
#             # podcast_dialog = bgprompt.call_llm(model="gemini-1.5-pro", prompt_filename="prompts/pass3.txt", notes=notes, assessment1=assessment1, assessment2=assessment2)
#             podcast_dialog = notes
#         except Exception as e:
#             print(f"Error generate_podcast: {e.args}")
#             print(e)
#             raise e
        
#         return podcast_dialog

