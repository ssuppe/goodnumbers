# .agent/engine.py
import os
import sys
from openai import OpenAI

class AgentEngine:
    def __init__(self):
        # USAGE: export OPENAI_API_BASE=http://localhost:8080/v1
        base_url = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1")
        api_key = os.getenv("OPENAI_API_KEY", "dummy-key")
        self.model = os.getenv("AGENT_MODEL", "gemini-1.5-pro")

        try:
            self.client = OpenAI(base_url=base_url, api_key=api_key)
        except Exception as e:
            print(f"❌ Could not initialize OpenAI client: {e}")
            sys.exit(1)

    def chat(self, messages, temperature=0.7):
        print(f"   Generating with {self.model}...", end="", flush=True)
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature
            )
            print(" Done.")
            return response.choices[0].message.content
        except Exception as e:
            print(f"\n❌ API Error: {e}")
            sys.exit(1)
