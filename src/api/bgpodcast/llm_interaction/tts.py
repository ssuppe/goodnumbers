# import json
# import asyncio
# import time

# import google.cloud.texttospeech as tts
# from google.api_core import client_options

# from pydantic import BaseModel
# import google.cloud.texttospeech as tts
# from google.api_core import client_options

# import os
# import time
# import asyncio
# import time
# from fastapi import HTTPException
# from pydantic import BaseModel
# async def test():

#     dialog = PodcastDialog()
#     dialog.dialog = """
# <speak>
#   Here are <say-as interpret-as="characters">SSML</say-as> samples.
#     <break time="1s"/>
#     I can pause <break time="3s"/>.
#     <break time="500ms"/>
#     I can speak in cardinals. Your number is <say-as interpret-as="cardinal">10</say-as>.
#     <break time="500ms"/>
#     Or I can speak in ordinals. You are <say-as interpret-as="ordinal">10</say-as> in line.
#     <break time="500ms"/>
#     Or I can even speak in digits. The digits for ten are <say-as interpret-as="characters">10</say-as>.
#     <break time="500ms"/>
#     I can also substitute phrases, like the <sub alias="World Wide Web Consortium">W3C</sub>.
#     <break time="500ms"/>
#     Finally, I can speak a paragraph with two sentences.
#     <p><s>This is sentence one.</s><s>This is sentence two.</s></p>
# </speak>"""

#     result = await gen_podcast(dialog)
#     print("Generated podcast, here's the first result:")
#     print(result)

#     # Check status periodically
#     start_time = time.time()
#     while time.time() - start_time < TIMEOUT:
#         status = await get_job_status(result['operation_id'])
#         print(f"\nCurrent status (after {int(time.time() - start_time)} seconds):")
#         print(json.dumps(status, indent=2))
        
#         if status["status"] == "complete":
#             # print(status["result"])
#             break
#         elif status["status"] == ["error"]:
#             # print(status["error"])
#             break
#         else:
#             # print("Still processing...")
#             print(status)
            
#         await asyncio.sleep(POLLING_INTERVAL)
        

# if __name__ == "__main__":
#     asyncio.run(test())