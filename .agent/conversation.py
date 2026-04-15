import os
import sys
import subprocess
from engine import AgentEngine
from context import build_full_context

# --- CONFIGURATION ---
ENV_DEFAULTS = {
    "OPENAI_API_BASE": "http://localhost:2048/v1",
    "OPENAI_API_KEY": "dummy-key",
    "AGENT_MODEL": "gemini-3-pro-preview"
}

for key, value in ENV_DEFAULTS.items():
    if key not in os.environ:
        os.environ[key] = value

OUTPUT_DIR = "specs/conversation"
EDITOR = os.environ.get("EDITOR", "nano")

def setup_dirs():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

def save_file(filepath, content):
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"   💾 Saved to: {filepath}")

def read_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        return f.read()

def load_prompt(name, **kwargs):
    # Loads text from .agent/prompts/
    path = os.path.join(os.path.dirname(__file__), "prompts", name)
    try:
        with open(path, "r") as f:
            return f.read().format(**kwargs)
    except FileNotFoundError:
        print(f"❌ Error: Prompt file '{name}' not found in .agent/prompts/")
        sys.exit(1)

def main():
    # 1. Setup
    setup_dirs()
    engine = AgentEngine()
    project_root = os.getcwd()
    
    # 2. Get Input (File or Arg)
    if len(sys.argv) < 2:
        print("Usage: python3 .agent/conversation.py <request_file_or_text>")
        sys.exit(1)

    input_arg = sys.argv[1]
    if os.path.exists(input_arg):
        with open(input_arg, "r", encoding="utf-8") as f:
            user_input = f.read().strip()
        print(f"📄 Loaded prompt from file: {input_arg}")
    else:
        user_input = input_arg
        print(f"💬 Used command line prompt")

    # 3. Load Context & System Persona
    static_context = build_full_context(project_root)
    sys_persona = load_prompt("0_system_base.txt")
    tool_instructions = (
        "\n\nYou have access to tools to read the file system. "
        "If the user asks about a file you haven't seen, DO NOT hallucinate. "
        "Use 'list_files' or 'read_file' to check the real content first."
    )
    
    full_system_msg = f"{sys_persona}{tool_instructions}\n\n{static_context}"
        
    conversation_history = [
        {"role": "system", "content": full_system_msg},
        {"role": "user", "content": user_input}
    ]

    # 5. The Conversation Loop
    current_file_path = os.path.join(OUTPUT_DIR, "current_output.md")
    first_run = True

    while True:
        if first_run:
            print("\n🤖 Generating initial response based on system prompt...")
        else:
            print("\n🤖 Thinking...")

        # -- Call AI --
        response = engine.chat(conversation_history)
        conversation_history.append({"role": "assistant", "content": response})
        
        # -- Save --
        save_file(current_file_path, response)
        first_run = False

        # -- Interaction Gate --
        while True:
            print(f"\n👉 Options:")
            print(f"   [c]hat      -> Type a reply/request changes")
            print(f"   [e]dit      -> Open '{current_file_path}' in {EDITOR}")
            print(f"   [r]etry     -> Regenerate the last response (try again)")
            print(f"   [q]uit      -> Exit")
            
            choice = input("   > ").lower().strip()

            if choice == 'q':
                print("Bye!")
                sys.exit(0)

            elif choice == 'e':
                subprocess.call([EDITOR, current_file_path])
                # Reload manually edited content into memory
                edited_content = read_file(current_file_path)
                # Update the AI's memory of what it "wrote" (or what is now true)
                conversation_history[-1]["content"] = edited_content
                print("   (AI memory updated with your manual edits)")
                # Loop back to menu so you can chat about the edits
                continue 

            elif choice == 'c':
                user_msg = input("\n👤 You: ")
                conversation_history.append({"role": "user", "content": user_msg})
                break # Break inner loop, go to top of outer loop to generate response

            elif choice == 'r':
                # Remove last assistant message
                if conversation_history and conversation_history[-1]["role"] == "assistant":
                    conversation_history.pop()
                print("   (Last response discarded. Retrying...)")
                break # Break inner loop, triggers generation again

            else:
                print("   Invalid choice.")

if __name__ == "__main__":
    main()