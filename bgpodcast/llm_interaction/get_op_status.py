# import time
# from fastapi import HTTPException
# from google.api_core import client_options
# import google.cloud.texttospeech as tts
# from pydantic import BaseModel


# async def test(result):
#      print(result)
#      # Check status periodically
#      start_time = time.time()
#      while time.time() - start_time < TIMEOUT:
#           status = await get_job_status(result)
#           print("Current status:", status)
          
#           if status["status"] in ["complete", "error"]:
#                break
               
#           await asyncio.sleep(POLLING_INTERVAL)


# import asyncio
# import sys
# import ast
# q