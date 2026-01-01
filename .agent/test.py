import os
import sys
from openai import OpenAI

# 1. Setup Configuration (Matching main.py defaults)
base_url = os.environ.get("OPENAI_API_BASE", "http://localhost:2048/v1")
api_key = os.environ.get("OPENAI_API_KEY", "dummy-key")
model = os.environ.get("AGENT_MODEL", "gemini-3-pro-preview")

print("--- DIAGNOSTICS ---")
print(f"Target URL : {base_url}")
print(f"API Key    : {api_key[:4]}...{api_key[-4:] if len(api_key)>8 else '****'}")
print(f"Model      : {model}")
print("-------------------")

# 2. Initialize Client
try:
    client = OpenAI(base_url=base_url, api_key=api_key)
except Exception as e:
    print(f"❌ Failed to initialize client: {e}")
    sys.exit(1)

# 3. Send Test Request
print(f"Sending test prompt to '{model}'...")

try:
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "user", "content": "Reply with only the word 'Connected'."}
        ]
    )
    
    content = response.choices[0].message.content
    print(f"\n✅ SUCCESS!")
    print(f"Response: {content}")

except Exception as e:
    print(f"\n❌ CONNECTION FAILED")
    print(f"Error details: {e}")
    print("\nTroubleshooting:")
    print("1. Is your proxy server running?")
    print(f"2. Is '{model}' the correct model name for your proxy?")
    print("3. Check your OPENAI_API_BASE environment variable.")