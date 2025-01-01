import json


async def async_generate(prompt, model):
    """
    Generate
    """
    response = await model.generate_content_async(
        prompt,
        stream=False
    )
    return response


async def async_generate_json(prompt, model, schema) -> dict:
    """
    Generate formal JSON
    """
    import typing_extensions as typing

    # class PodcastJSON(typing.TypedDict):
    #     title: str
    #     description: str
    #     podcast_ssml: str

    model.response_mime_type = "application/json"
    model.response_schema = schema

    print("generating JSON")
    response = await model.generate_content_async(
        prompt,
        stream=False
    )

    response = json.loads(response.text.replace(
        "```json\n", "").replace("\n```", ""))

    print("done")
    return response
