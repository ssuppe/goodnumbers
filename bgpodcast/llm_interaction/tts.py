import asyncio
import time
from typing import Optional
import google.cloud.texttospeech as tts
from google.api_core import client_options


DEFAULT_LANGUAGE = "en-US"
MALE_VOICE = "en-GB-Wavenet-B"
FEMALE_VOICE = "en-US-Wavenet-C"
STANDARD_API_BYTE_LIMIT = 5000  # Google's limit for standard API

async def synthesize_text(
    ssml_text: str, 
    output_file_path: str, 
    voice_name: str, 
    language_code: str = DEFAULT_LANGUAGE,
    polling_interval: int = 10,
    timeout: int = 600
) -> Optional[str]:
    """
    Synthesize text to speech, choosing between standard and long-form APIs
    based on input length.
    
    Args:
        ssml_text: The SSML text to synthesize
        output_file_path: Path where the audio file should be saved
        voice_name: Name of the voice to use
        language_code: Language code for synthesis
        polling_interval: How often to check operation status (seconds)
        timeout: Maximum time to wait for operation (seconds)
    """
    client_opts = client_options.ClientOptions(api_endpoint='texttospeech.googleapis.com:443')
    
    # Check text length first to choose the appropriate API
    text_bytes = len(ssml_text.encode('utf-8'))
    use_long_form = text_bytes > STANDARD_API_BYTE_LIMIT
    
    try:
        if not use_long_form:
            # Use standard API for short texts
            async with tts.TextToSpeechAsyncClient(client_options=client_opts) as tts_client:
                response = await tts_client.synthesize_speech(
                    input=tts.SynthesisInput(ssml=ssml_text),
                    voice=tts.VoiceSelectionParams(language_code=language_code, name=voice_name),
                    audio_config=tts.AudioConfig(audio_encoding=tts.AudioEncoding.MP3),
                )
                
                with open(output_file_path, "wb") as f:
                    f.write(response.audio_content)
                    
                return output_file_path
                
        else:
            # Use long-form API for longer texts
            print(f"Text length ({text_bytes} bytes) exceeds standard API limit, using long-form synthesis...")
            
            async with tts.TextToSpeechLongAudioSynthesizeAsyncClient(client_options=client_opts) as client:
                # Start the long audio synthesis operation
                operation = await client.synthesize_long_audio(
                    request=tts.SynthesizeLongAudioRequest(
                        input=tts.SynthesisInput(ssml=ssml_text),
                        voice=tts.VoiceSelectionParams(
                            language_code=language_code,
                            name=voice_name
                        ),
                        audio_config=tts.AudioConfig(
                            audio_encoding=tts.AudioEncoding.MP3
                        ),
                        output_config=tts.OutputConfig(
                            output_path=output_file_path
                        )
                    )
                )
                
                # Poll for completion
                start_time = time.time()
                while True:
                    if time.time() - start_time > timeout:
                        raise TimeoutError(f"Operation timed out after {timeout} seconds")
                    
                    if operation.done():
                        if operation.exception():
                            raise operation.exception()
                        break
                        
                    await asyncio.sleep(polling_interval)
                    print("Synthesis in progress...")
                
                return output_file_path
                
    except Exception as e:
        print(f"Error in synthesis: {str(e)}")
        raise

async def test():
    try:
        with open("test.ssml", "r", encoding="utf-8") as tf:
            test_str = tf.read()
            output_path = await synthesize_text(
                test_str,
                "/tmp/test.mp3", 
                voice_name=MALE_VOICE, 
                language_code=DEFAULT_LANGUAGE
            )
            print(f"Audio file created successfully at: {output_path}")
    except Exception as e:
        print(f"Failed to create audio: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test())