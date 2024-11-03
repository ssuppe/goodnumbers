import time
import sys
import pprint
import asyncio
import gcloud
# from fastapi import HTTPException
# from google.api_core import client_options
# import google.cloud.texttospeech as tts
# from pydantic import BaseModel



async def test(op_id : str):
    # Check status periodically
    start_time = time.time()
    while time.time() - start_time < 300:
        status = await gcloud.get_job_status(op_id)
        print(f"\nCurrent status (after {
              int(time.time() - start_time)} seconds):")
        pprint.pprint(status)

        if status.status == "done":
            print("All done!")

            # print(status["result"])
        elif status.status == "error":
            print("Error!")
            print(status["error"])
        else:
            print("Still processing...")
            print(status)

        await asyncio.sleep(10)


if __name__ == "__main__":
    asyncio.run(test(sys.argv[1]))