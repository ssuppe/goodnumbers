import os
import sys
import json
import subprocess
from openai import OpenAI

# --- CONFIGURATION ---
# 1. Setup Environment defaults for your Local Engine
ENV_DEFAULTS = {
    "OPENAI_API_BASE": "http://localhost:2048/v1",
    "OPENAI_API_KEY": "dummy-key",
    "AGENT_MODEL": "gemini-3-pro-preview"
}

for k, v in ENV_DEFAULTS.items():
    if k not in os.environ:
        os.environ[k] = v

# 2. Tool Settings
TEST_CMD = "pytest"  # <--- Verify this matches your project
DYNAMIC_CONTEXT_DIR = ".agent/dynamic_context"
CONFIG_FILE = ".aider.conf.yml"

# 3. Hardcoded list of extra files to always read
HARDCODED_CONTEXT_FILES = [
     "docs/PRD.md",           # Example
    "docs/DEVELOPMENT_PROCESS.md", # Example
    "docs/TECHNICAL_SPECIFICATION.md"  # Example
]

class SimpleEngine:
    def __init__(self):
        self.client = OpenAI(
            base_url=os.environ["OPENAI_API_BASE"],
            api_key=os.environ["OPENAI_API_KEY"]
        )
        self.model = os.environ["AGENT_MODEL"]

    def chat(self, messages, temperature=1.0):
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"❌ API Error: {e}")
            sys.exit(1)

def read_file(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        print(f"❌ Error: File not found: {path}")
        sys.exit(1)

def get_context_files():
    files_to_read = []
    if os.path.exists(DYNAMIC_CONTEXT_DIR):
        for root, _, files in os.walk(DYNAMIC_CONTEXT_DIR):
            for file in files:
                files_to_read.append(os.path.join(root, file))
    
    for f in HARDCODED_CONTEXT_FILES:
        if os.path.exists(f):
            files_to_read.append(f)
    return files_to_read

def get_implementation_steps(engine, spec_content, context_summary=""):
    print("\n🧠 Analyzing spec and generating TDD plan...")
    context_note = f"\nAdditional Context Files Available: {context_summary}\n" if context_summary else ""

    prompt = (
        "You are a Senior Technical Lead. I have a technical specification below.\n"
        "Break this implementation down into a list of atomic, sequential TDD steps.\n"
        "Each step must be small enough to be implemented in a single coding turn.\n"
        "Each step must imply writing a test first.\n\n"
        f"SPECIFICATION:\n{spec_content}\n"
        f"{context_note}\n"
        "OUTPUT FORMAT:\n"
        "Return strictly a valid JSON list of strings. No markdown formatting. No preamble.\n"
        "Example: [\"Create file utils.py with basic math functions\", \"Write test for add function\", \"Implement add function\"]\n"
    )
    
    messages = [{"role": "user", "content": prompt}]
    response = engine.chat(messages, temperature=0.2)
    clean_response = response.replace("```json", "").replace("```", "").strip()
    
    try:
        steps = json.loads(clean_response)
        if not isinstance(steps, list): raise ValueError("Response is not a list")
        return steps
    except (json.JSONDecodeError, ValueError):
        print(f"❌ Error: Model did not return valid JSON. Response:\n{response}")
        sys.exit(1)

def run_aider_step(spec_path, step_description, step_index, total_steps, context_files):
    print(f"\n🚀 [Step {step_index}/{total_steps}] Executing: {step_description}")
    
    msg = f"Step {step_index}: {step_description}. Context provided in {spec_path}."
    
    # Base Command
    cmd = [
        "aider",
        "--message", msg,
        "--read", spec_path,
        "--yes",
        "--auto-commits"
        # "--test-cmd", TEST_CMD
    ]

    # Add Config File if it exists
    if os.path.exists(CONFIG_FILE):
        cmd.extend(["--config", CONFIG_FILE])

    # Add Context Files
    for cf in context_files:
        cmd.extend(["--read", cf])
    
    # --- FIX FOR PAGER INTERRUPTION ---
    # We copy the current environment and set PAGER to 'cat'.
    # This forces tools (like git diff or aider's pager) to print to stdout 
    # instead of opening an interactive 'less' session.
    env = os.environ.copy()
    env["PAGER"] = "cat"
    
    try:
        # We pass env=env to the subprocess
        result = subprocess.run(cmd, check=False, env=env)
        
        if result.returncode != 0:
            print(f"⚠️  Aider finished with exit code {result.returncode}.")
        else:
            print(f"✅ Step {step_index} Complete.")
            
    except FileNotFoundError:
        print("❌ Error: 'aider' command not found. Is it installed?")
        sys.exit(1)

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 autopilot.py <path_to_spec_file>")
        sys.exit(1)
    
    spec_path = sys.argv[1]
    spec_content = read_file(spec_path)

    engine = SimpleEngine()

    context_files = get_context_files()
    context_summary = ", ".join([os.path.basename(f) for f in context_files]) if context_files else ""
    if context_files:
        print(f"📚 Context loaded: {context_summary}")

    steps = get_implementation_steps(engine, spec_content, context_summary)
    
    print(f"\n📋 Generated {len(steps)} implementation steps:")
    for i, step in enumerate(steps, 1):
        print(f"   {i}. {step}")
    
    confirm = input("\nStart Autopilot? (y/n) > ").lower().strip()
    if confirm != 'y':
        print("Aborted.")
        sys.exit(0)

    for i, step in enumerate(steps, 1):
        run_aider_step(spec_path, step, i, len(steps), context_files)

    print("\n✨ Autopilot Finished. All steps executed.")

if __name__ == "__main__":
    main()