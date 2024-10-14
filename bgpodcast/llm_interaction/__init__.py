from l2m2.client import LLMClient
from bgpodcast.utils import bgutils

GEMINI_KEY  = bgutils.get_gemini_key()

client = LLMClient(providers={"google" : GEMINI_KEY})


def call_llm(model="gemini-1.5-pro", prompt_filename="", **kwargs):
    response = None
    with open(f"{prompt_filename}", "r", encoding="utf-8") as promptf:
        prompt = promptf.read()
        for key, value in kwargs.items():
            prompt = prompt.replace(f"{{{key}}}", value)
        
        print(f"{prompt_filename}")
        print(f"{prompt}")

        response = client.call(model=model, prompt = prompt, timeout=60, bypass_memory=True)
    return response