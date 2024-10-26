from datetime import datetime
from pprint import pprint
import traceback
import google.cloud.texttospeech as tts
from google.api_core import client_options
from google.protobuf.json_format import MessageToDict
from google.cloud import storage
from fastapi import HTTPException
from pydantic import BaseModel


class PodcastDialog(BaseModel):
    dialog: str | None = None

BUCKET_NAME = "goodnumbers"  # Replace with your bucket name
GCS_PATH = "audio-files"  # Folder in bucket to store audio files
POLLING_INTERVAL = 10  # seconds

# Time constants in seconds
SECONDS_PER_MINUTE = 60
POLLING_INTERVAL = 10  # Check status every 10 seconds
TIMEOUT_MINUTES = 10   # Total timeout in minutes
TIMEOUT = TIMEOUT_MINUTES * SECONDS_PER_MINUTE  # Convert to seconds

async def get_job_status(operation_details: str | dict) -> dict:
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
    operation_id = operation_details if isinstance(operation_details, str) else operation_details.get('operation_id')
    
    if not operation_id:
        raise ValueError("Invalid operation details provided")

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
            print(f"Operation name: {operation.name}")
            print(f"Operation done: {operation.done}")
            print("Operation metadata:")
            pprint(operation.metadata)
            print("Operation error details:")
            pprint(operation.error)
            
            if hasattr(operation.error, 'details'):
                print("Error details:")
                pprint(operation.error.details)
            
            if hasattr(operation.error, 'message'):
                print("Error message:")
                pprint(operation.error.message)
                
            if hasattr(operation, 'result'):
                print("Operation result:")
                pprint(operation.result())

           # Get operation details using public methods
            status_dict = {
                "name": operation.name,
                "done": operation.done,
                "metadata": MessageToDict(operation.metadata) if operation.metadata else None,
            }
            
            if operation.done:
                print("Done!")
                print(operation)
                if operation.error:
                    status_dict.update({
                        "status": "error",
                        "error": MessageToDict(operation.error)
                    })
                else:
                    status_dict.update({
                        "status": "complete",
                        "result": MessageToDict(operation.result()) if operation.result() else None
                    })
            else:
                status_dict["status"] = "processing"
            
            # print(json.dumps(status_dict, indent=2))
            return status_dict

    except Exception as e:
        error_msg = str(e)
        stack_trace = traceback.format_exc()
        print(f"Error in get_job_status: {error_msg}")
        print(f"Stack trace: {stack_trace}")
        raise HTTPException(status_code=500, detail={
            "error": error_msg,
            "stack_trace": stack_trace
        }) from e

async def gen_podcast(dialog: PodcastDialog) -> dict:
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
                        name="en-US-Standard-D"
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

            return {
                "status": "processing",
                "operation_id": operation.operation.name,
                "gcs_path": gcs_path,
                "bucket_name": BUCKET_NAME,
                "message": "Audio generation started successfully"
            }

    except Exception as e:
        print(f"Error in gen_podcast: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) from e