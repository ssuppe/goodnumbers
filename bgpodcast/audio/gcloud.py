from datetime import datetime
from pprint import pprint
import asyncio
import time
import traceback
import google.cloud.texttospeech as tts
from google.api_core import client_options
from google.protobuf.json_format import MessageToDict
from google.cloud import storage
from fastapi import HTTPException
from bgpodcast.utils.objects import JobCheckResponse, PodcastDialog, PodcastGenerateResult

BUCKET_NAME = "goodnumbers"  # Replace with your bucket name
GCS_PATH = "audio-files"  # Folder in bucket to store audio files
POLLING_INTERVAL = 10  # seconds

# Time constants in seconds
SECONDS_PER_MINUTE = 60
POLLING_INTERVAL = 10  # Check status every 10 seconds
TIMEOUT_MINUTES = 10   # Total timeout in minutes
TIMEOUT = TIMEOUT_MINUTES * SECONDS_PER_MINUTE  # Convert to seconds


async def get_job_status(operation_id: str) -> JobCheckResponse:
    """
    Check the status of a long-form audio synthesis operation with enhanced error reporting.

    Args:
        operation_details: Either operation ID string or dictionary containing operation details

    Returns:
        Dictionary containing current status information and detailed error if present

    Raises:
        HTTPException: For various Google API errors
        ValueError: If operation_details is invalid
    """
    # Handle both string (operation_id) and dictionary input
    # operation_id = operation_details if isinstance(operation_details, str) else operation_details.get('operation_id')

    # if not operation_id:
    #     raise ValueError("Invalid operation details provided")

    # operation_id = jobcheck.operation
    print(f"operation id: {operation_id}")
    try:
        # Initialize Text-to-Speech client with specific endpoint
        client_opts = client_options.ClientOptions(
            api_endpoint='texttospeech.googleapis.com:443'
        )

        async with tts.TextToSpeechLongAudioSynthesizeAsyncClient(
            client_options=client_opts
        ) as client:
            # Get the operation object and await its completion
            operation = await client.transport.operations_client.get_operation(
                operation_id
            )

            # Debug information
            print("\nDebug Information:")
            print(type(operation))
            pprint(operation)

            # Get operation details using public methods
            status = JobCheckResponse(done=True)
            status.name = operation.name
            status.done = operation.done
            status.metadata = MessageToDict(
                operation.metadata) if operation.metadata else None
            if operation.done is True:
                print(f"operation done? {operation.done}")
                if operation.response:
                    print("success")
                    status.status = "done"
                    status.error = MessageToDict(operation.response)
                elif operation.status == 'error' and operation.error != {}:
                    print("error")
                    status.status = "error"
                    status.error = MessageToDict(operation.error)
                else:
                    print("else")
                    status.status = "unknown"
                    status.result = MessageToDict(
                        operation.result()) if operation.result() else None
            else:
                status.status = "processing"

            print(f"returning {status}")
            return status

    except Exception as e:
        error_msg = str(e)
        stack_trace = traceback.format_exc()
        print(f"Error in get_job_status: {error_msg}")
        print(f"Stack trace: {stack_trace}")
        raise HTTPException(status_code=500, detail={
            "error": error_msg,
            "stack_trace": stack_trace
        }) from e


async def gen_podcast(dialog: PodcastDialog) -> PodcastGenerateResult:
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
                    parent="projects/gemini-437920/locations/global",
                    input=tts.SynthesisInput(ssml=dialog.dialog),
                    voice=tts.VoiceSelectionParams(
                        language_code="en-US",
                        name="en-GB-Wavenet-B"
                    ),
                    audio_config=tts.AudioConfig(
                        audio_encoding=tts.AudioEncoding.LINEAR16,
                        speaking_rate=1.0,
                        pitch=0.0,
                        # sample_rate_hertz=24000
                    ),
                    output_gcs_uri=output_gcs_uri
                )
            )

            res = PodcastGenerateResult(status="processing",\
                operation_id=operation.operation.name,\
                gcs_path=gcs_path,\
                bucket_name=BUCKET_NAME,\
                message="Audio generation started successfully")
            return res

            # return {
            #     "status": "processing",
            #     "operation_id": operation.operation.name,
            #     "gcs_path": gcs_path,
            #     "bucket_name": BUCKET_NAME,
            #     "message": "Audio generation started successfully"
            # }

    except Exception as e:
        print(f"Error in gen_podcast: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) from e


async def test():
    dialog = PodcastDialog()
    dialog.dialog = """
<speak>
  Here are <say-as interpret-as="characters">SSML</say-as> samples.
    <break time="1s"/>
    I can pause <break time="3s"/>.
    <break time="500ms"/>
    I can speak in cardinals. Your number is <say-as interpret-as="cardinal">10</say-as>.
    <break time="500ms"/>
    Or I can speak in ordinals. You are <say-as interpret-as="ordinal">10</say-as> in line.
    <break time="500ms"/>
    Or I can even speak in digits. The digits for ten are <say-as interpret-as="characters">10</say-as>.
    <break time="500ms"/>
    I can also substitute phrases, like the <sub alias="World Wide Web Consortium">W3C</sub>.
    <break time="500ms"/>
    Finally, I can speak a paragraph with two sentences.
    <p><s>This is sentence one.</s><s>This is sentence two.</s></p>
</speak>"""

    result = await gen_podcast(dialog)
    print("Generated podcast, here's the first result:")
    print(result)

    # Check status periodically
    start_time = time.time()
    while time.time() - start_time < TIMEOUT:
        status = await get_job_status(result['operation_id'])
        print(f"\nCurrent status (after {
              int(time.time() - start_time)} seconds):")
        pprint(status)

        if status.status == "done":
            print("All done!")

            # print(status["result"])
            break
        elif status.status == "error":
            # print(status["error"])
            break
        else:
            # print("Still processing...")
            print(status)

        await asyncio.sleep(POLLING_INTERVAL)


if __name__ == "__main__":
    asyncio.run(test())
