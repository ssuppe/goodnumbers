import os
import sys
import subprocess
from engine import AgentEngine
from context import build_full_context

# --- CONFIGURATION & DEFAULTS ---
# 1. Environment Defaults (Applied only if env vars are missing)
ENV_DEFAULTS = {
    "OPENAI_API_BASE": "http://localhost:2048/v1",  # Your proxy URL
    "OPENAI_API_KEY": "dummy-key",                  # Your proxy key
    "AGENT_MODEL": "gemini-3-pro-preview"                 # Your preferred model
}

# Apply defaults
for key, value in ENV_DEFAULTS.items():
    if key not in os.environ:
        os.environ[key] = value

# 2. File Paths
DRAFT_DIR = "specs/drafts"
FINAL_DIR = "specs/final"
EDITOR = os.environ.get("EDITOR", "vi") 

def setup_dirs():
    os.makedirs(DRAFT_DIR, exist_ok=True)
    os.makedirs(FINAL_DIR, exist_ok=True)

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

def human_review_gate(engine, conversation_history, current_content, filepath, step_name):
    """
    The Loop: Continue, Edit, or Refine (Chat).
    """
    while True:
        print(f"\n✋ GATE: {step_name}")
        print(f"   [c]ontinue  -> Next step")
        print(f"   [e]dit      -> Open in {EDITOR}")
        print(f"   [r]efine    -> Give instructions to rewrite this draft")
        print(f"   [q]uit")
        
        choice = input("   > ").lower().strip()
        
        if choice == 'q':
            sys.exit(0)
        elif choice == 'c':
            return current_content
        elif choice == 'e':
            subprocess.call([EDITOR, filepath])
            current_content = read_file(filepath)
            conversation_history[-1]["content"] = current_content
            print("   (Manual edits loaded)")
        elif choice == 'r':
            instructions = input("   📝 Enter instructions for rewrite: ")
            conversation_history.append({
                "role": "user", 
                "content": f"Rewrite the previous document based on these instructions: {instructions}. Output only the full updated document."
            })
            current_content = engine.chat(conversation_history)
            conversation_history.append({"role": "assistant", "content": current_content})
            save_file(filepath, current_content)

def main():
    # 1. Validate Args
    if len(sys.argv) < 2:
        print("Usage: python3 .agent/main.py <path_to_feature_request_file>")
        sys.exit(1)

    request_path = sys.argv[1]

    # 2. Read Feature Request from File
    try:
        if not os.path.exists(request_path):
            print(f"❌ Error: The file '{request_path}' was not found.")
            sys.exit(1)
            
        with open(request_path, "r", encoding="utf-8") as f:
            feature_request = f.read().strip()
            
        print(f"📄 Loaded request from: {request_path} ({len(feature_request)} chars)")
        
    except Exception as e:
        print(f"❌ Error reading file: {e}")
        sys.exit(1)

    setup_dirs()
    
    # 3. Initialize Engine (Uses defaults we set above)
    engine = AgentEngine()
    project_root = os.getcwd()
    static_context = build_full_context(project_root)
    conversation_history = []

    # --- STEP 1: INITIAL PLAN ---
    print("\n🚀 [Step 1] Generating Engineering Plan...")
    sys_prompt = load_prompt("0_system_base.txt")
    step1_prompt = load_prompt("1_init_plan.txt", manager_request=feature_request)
    
    conversation_history.append({"role": "system", "content": sys_prompt + "\n" + static_context})
    conversation_history.append({"role": "user", "content": step1_prompt})
    
    plan_v1 = engine.chat(conversation_history)
    conversation_history.append({"role": "assistant", "content": plan_v1})
    
    draft_path = os.path.join(DRAFT_DIR, "v1_initial.md")
    save_file(draft_path, plan_v1)
    
    plan_v1 = human_review_gate(engine, conversation_history, plan_v1, draft_path, "Initial Plan")

    # --- STEP 2: CRITIQUE ---
    print("\n🧐 [Step 2] Auto-Critique...")
    conversation_history.append({"role": "user", "content": load_prompt("2_critique.txt")})
    plan_v2 = engine.chat(conversation_history)
    conversation_history.append({"role": "assistant", "content": plan_v2})
    save_file(os.path.join(DRAFT_DIR, "v2_critique.md"), plan_v2)

    # --- STEP 3: TDD ENFORCEMENT ---
    print("\n🧪 [Step 3] Enforcing TDD...")
    conversation_history.append({"role": "user", "content": load_prompt("3_tdd_enforce.txt")})
    plan_v3 = engine.chat(conversation_history)
    conversation_history.append({"role": "assistant", "content": plan_v3})
    
    draft_tdd_path = os.path.join(DRAFT_DIR, "v3_tdd.md")
    save_file(draft_tdd_path, plan_v3)
    
    plan_v3 = human_review_gate(engine, conversation_history, plan_v3, draft_tdd_path, "TDD Spec")

    # --- STEP 4: SECURITY REVIEW ---
    print("\n🛡️  [Step 4] Security Review...")
    conversation_history.append({"role": "user", "content": load_prompt("4_sec_review.txt")})
    sec_feedback = engine.chat(conversation_history)
    conversation_history.append({"role": "assistant", "content": sec_feedback})
    
    print("\n--- SECURITY FINDINGS ---")
    print(sec_feedback)
    print("-------------------------")
    
    user_guidance = input("\nInstructions for final rewrite (e.g., 'Apply all', 'Ignore item 2'): ")

    # --- STEP 5: FINAL REWRITE ---
    print("\n✍️  [Step 5] Finalizing...")
    final_prompt = load_prompt("5_sec_rewrite.txt", user_notes=user_guidance)
    conversation_history.append({"role": "user", "content": final_prompt})
    
    final_spec = engine.chat(conversation_history)
    final_path = os.path.join(FINAL_DIR, "final_spec.md")
    save_file(final_path, final_spec)
    
    print(f"\n✅ DONE. Spec ready: {final_path}")
    print("Run: aider --read specs/final/final_spec.md")

if __name__ == "__main__":
    main()