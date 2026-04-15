import os
import sys
import shutil
import re
import subprocess
import traceback 
import threading
import datetime
from enum import Enum, auto
from textual.app import App, ComposeResult
from textual.containers import Vertical
from textual.widgets import Header, Footer, RichLog, MarkdownViewer, TextArea
from textual import work, events

# --- EXISTING IMPORTS ---
try:
    from engine import AgentEngine
    from context import build_full_context
except ImportError:
    print("⚠️  Could not import engine/context. Make sure you are in the project root.")
    sys.exit(1)

# --- CONFIGURATION ---
ENV_DEFAULTS = {
    "OPENAI_API_BASE": "http://localhost:2048/v1",
    "OPENAI_API_KEY": "dummy-key",
    "AGENT_MODEL": "gemini-3-pro-preview"
}
for k, v in ENV_DEFAULTS.items():
    if k not in os.environ:
        os.environ[k] = v

DRAFT_DIR = "specs/drafts"
FINAL_DIR = "specs/final"
DYNAMIC_CONTEXT_DIR = ".agent/dynamic_context"
EDITOR = os.environ.get("EDITOR", "nano")

def setup_dirs():
    os.makedirs(DRAFT_DIR, exist_ok=True)
    os.makedirs(FINAL_DIR, exist_ok=True)
    os.makedirs(DYNAMIC_CONTEXT_DIR, exist_ok=True)
    return os.path.abspath(DRAFT_DIR)

def load_prompt(name, **kwargs):
    path = os.path.join(os.path.dirname(__file__), "prompts", name)
    try:
        with open(path, "r") as f:
            return f.read().format(**kwargs)
    except FileNotFoundError:
        raise FileNotFoundError(f"Prompt file missing: {path}")

# --- STATE MANAGEMENT ---
class WorkflowState(Enum):
    INIT = auto()
    GENERATING_PLAN = auto()
    REVIEW_PLAN = auto()
    GENERATING_CRITIQUE = auto()
    GENERATING_TDD = auto()
    REVIEW_TDD = auto()
    GENERATING_SEC = auto()
    WAITING_SEC_INPUT = auto()
    GENERATING_FINAL = auto()
    DONE = auto()

class AgentWorkflowApp(App):
    CSS = """
    Screen { layout: horizontal; }
    #left-pane { width: 40%; height: 100%; border-right: solid $accent; }
    #right-pane { width: 60%; height: 100%; }
    
    #chat-log { 
        height: 1fr; 
        border-bottom: solid $secondary;
        min-height: 10;
        scrollbar-size-vertical: 1;
    }
    
    TextArea { 
        height: 8; 
        dock: bottom;
        border-top: solid $accent;
    }
    """

    # F5 is now the "Universal Action" button
    BINDINGS = [
        ("q", "quit", "Quit"),
        ("f5", "smart_action", "Submit / Continue"), 
        ("f2", "edit_file", "Edit Current File"),        
    ]

    def __init__(self, feature_request, **kwargs):
        super().__init__(**kwargs)
        self.feature_request = feature_request
        self.engine = AgentEngine()
        self.conversation_history = []
        self.project_root = os.getcwd()
        self.state = WorkflowState.INIT
        self.current_file = None
        self.draft_abs_path = ""

    def compose(self) -> ComposeResult:
        yield Header()
        with Vertical(id="left-pane"):
            yield RichLog(id="chat-log", highlight=True, markup=True, wrap=True)
            yield TextArea(id="user-input", show_line_numbers=False)
        yield MarkdownViewer(id="right-pane", show_table_of_contents=False)
        yield Footer()

    def on_mount(self):
        self.draft_abs_path = setup_dirs()
        self.log_write("🤖 [bold green]Workflow Initializing...[/]")
        self.log_write(f"📂 Saving files to: [u]{self.draft_abs_path}[/]")
        self.log_write(f"📄 Request size: {len(self.feature_request)} chars")
        self.log_write("💡 [dim]Tip: Type feedback and press F5. Leave empty and press F5 to continue.[/]")
        
        self.run_step_1_plan()

    def log_write(self, msg):
        try:
            self.call_from_thread(self._log_write_impl, msg)
        except RuntimeError:
            self._log_write_impl(msg)

    def _log_write_impl(self, msg):
        self.query_one("#chat-log", RichLog).write(msg)

    def set_preview(self, content):
        self.query_one("#right-pane", MarkdownViewer).document.update(content)

    def process_file_mentions(self, text):
        tokens = text.split()
        raw_paths = [t[1:] for t in tokens if t.startswith("@")]
        
        if not raw_paths: return ""

        self.log_write("🔎 [cyan]Bundling context with Repomix...[/]")
        
        valid_paths = []
        for p in raw_paths:
            clean = p.rstrip(".,;:!?")
            if os.path.exists(clean):
                valid_paths.append(clean)
            else:
                self.log_write(f"   ⚠️ [yellow]Skipping missing:[/u] {clean}")

        if not valid_paths: return ""

        include_pattern = ",".join(valid_paths)
        timestamp = datetime.datetime.now().strftime("%H%M%S")
        output_filename = f"context_bundle_{timestamp}.xml"
        output_path = os.path.join(DYNAMIC_CONTEXT_DIR, output_filename)

        cmd = [
            "npx", "-y", "repomix",
            "--style", "xml",
            "--remove-empty-lines",
            "--include", include_pattern,
            "--output", output_path
        ]

        try:
            self.log_write(f"   🏃 Running Repomix on {len(valid_paths)} paths...")
            subprocess.run(cmd, capture_output=True, text=True, check=True)
            self.log_write(f"   ✅ Bundle created: [u]{output_filename}[/]")
            
            with open(output_path, "r", encoding="utf-8") as f:
                return f"\n\n{f.read()}\n\n"

        except Exception as e:
            self.log_write(f"   ❌ Error processing bundle: {e}")
            return ""

    # =========================================================================
    # WORKER METHODS
    # =========================================================================

    @work(exclusive=True, thread=True)
    def run_step_1_plan(self):
        try:
            self.state = WorkflowState.GENERATING_PLAN
            self.log_write("\n🚀 [bold yellow][Step 1] Generating Plan...[/]")
            
            # 1. Process @mentions
            injected_context = self.process_file_mentions(self.feature_request)
            
            # 2. Build Context
            static_context = build_full_context(self.project_root)
            
            # 3. Read Hardcoded Docs
            hardcoded_docs = [
                "docs/DEVELOPMENT_PROCESS.md",
                "docs/TECHNICAL_SPECIFICATION.md",
                "docs/PRD.md"
            ]
            doc_context = ""
            for doc in hardcoded_docs:
                if os.path.exists(doc):
                    with open(doc, "r", encoding="utf-8") as f:
                        doc_context += f"\n\n--- STANDARD CONTEXT: {doc} ---\n{f.read()}\n"

            full_manager_request = (
                f"{self.feature_request}\n\n"
                f"{injected_context}\n\n"
                f"{doc_context}" 
            )

            sys_prompt = load_prompt("0_system_base.txt")
            step1_prompt = load_prompt("1_init_plan.txt", manager_request=full_manager_request)
            
            tool_instructions = (
                "\n\nYou have access to tools to read the file system. "
                "If the user asks about a file you haven't seen, DO NOT hallucinate. "
                "Use 'list_files' or 'read_file' to check the real content first."
            )
            
            self.conversation_history = [
                {"role": "system", "content": sys_prompt + tool_instructions + "\n\n" + static_context},
                {"role": "user", "content": step1_prompt}
            ]

            plan_v1 = self.engine.chat(self.conversation_history) or ""
            self.conversation_history.append({"role": "assistant", "content": plan_v1})
            
            self.current_file = os.path.join(DRAFT_DIR, "v1_initial.md")
            with open(self.current_file, "w", encoding="utf-8") as f: 
                f.write(plan_v1)
            
            self.call_from_thread(self.finish_step_1, plan_v1)
        
        except Exception as e:
            self.log_write(f"❌ [bold red]Worker Error:[/]")
            self.log_write(f"{str(e)}")
            traceback.print_exc()

    def finish_step_1(self, content):
        self.set_preview(content)
        self.log_write(f"✅ [bold green]Saved: {self.current_file}[/]")
        self.log_write("👉 [bold cyan]Gate:[/]")
        self.log_write("   • Type feedback + [bold]F5[/] to Refine")
        self.log_write("   • Empty input + [bold]F5[/] to Continue")
        self.state = WorkflowState.REVIEW_PLAN

    @work(exclusive=True, thread=True)
    def run_step_2_and_3(self):
        try:
            self.state = WorkflowState.GENERATING_CRITIQUE
            self.log_write("\n🧐 [bold yellow][Step 2] Auto-Critique...[/]")
            
            self.conversation_history.append({"role": "user", "content": load_prompt("2_critique.txt")})
            critique = self.engine.chat(self.conversation_history) or ""
            self.conversation_history.append({"role": "assistant", "content": critique})
            
            with open(os.path.join(DRAFT_DIR, "v2_critique.md"), "w", encoding="utf-8") as f: 
                f.write(critique)
            
            self.call_from_thread(self.set_preview, critique)

            # Step 3
            self.state = WorkflowState.GENERATING_TDD
            self.log_write("\n🧪 [bold yellow][Step 3] Enforcing TDD...[/]")
            
            self.conversation_history.append({"role": "user", "content": load_prompt("3_tdd_enforce.txt")})
            plan_v3 = self.engine.chat(self.conversation_history) or ""
            self.conversation_history.append({"role": "assistant", "content": plan_v3})
            
            self.current_file = os.path.join(DRAFT_DIR, "v3_tdd.md")
            with open(self.current_file, "w", encoding="utf-8") as f: 
                f.write(plan_v3)
            
            self.call_from_thread(self.finish_step_3, plan_v3)

        except Exception as e:
            self.log_write(f"❌ [bold red]Worker Error:[/]")
            self.log_write(f"{str(e)}")
            traceback.print_exc()

    def finish_step_3(self, content):
        self.set_preview(content)
        self.log_write(f"✅ [bold green]Saved: {self.current_file}[/]")
        self.log_write("👉 [bold cyan]Gate:[/] Refine or Continue (F5).")
        self.state = WorkflowState.REVIEW_TDD

    @work(exclusive=True, thread=True)
    def run_step_4_security(self):
        try:
            self.state = WorkflowState.GENERATING_SEC
            self.log_write("\n🛡️  [bold yellow][Step 4] Security Review...[/]")
            
            self.conversation_history.append({"role": "user", "content": load_prompt("4_sec_review.txt")})
            sec_feedback = self.engine.chat(self.conversation_history) or ""
            self.conversation_history.append({"role": "assistant", "content": sec_feedback})
            
            self.call_from_thread(self.finish_step_4, sec_feedback)
        except Exception as e:
            self.log_write(f"❌ [bold red]Worker Error:[/]")
            self.log_write(f"{str(e)}")
            traceback.print_exc()

    def finish_step_4(self, content):
        self.set_preview(content)
        self.log_write("\n🛑 [bold red]Security Findings Above.[/]")
        self.log_write("👉 [bold white]Action Required:[/] Type guidance + F5.")
        self.state = WorkflowState.WAITING_SEC_INPUT

    @work(exclusive=True, thread=True)
    def run_step_5_final(self, user_guidance):
        try:
            self.state = WorkflowState.GENERATING_FINAL
            self.log_write("\n✍️  [bold yellow][Step 5] Finalizing...[/]")
            
            final_prompt = load_prompt("5_sec_rewrite.txt", user_notes=user_guidance)
            self.conversation_history.append({"role": "user", "content": final_prompt})
            
            final_spec = self.engine.chat(self.conversation_history) or ""
            
            self.current_file = os.path.join(FINAL_DIR, "final_spec.md")
            with open(self.current_file, "w", encoding="utf-8") as f: 
                f.write(final_spec)
            
            self.call_from_thread(self.finish_workflow, final_spec)
        except Exception as e:
            self.log_write(f"❌ [bold red]Worker Error:[/]")
            self.log_write(f"{str(e)}")
            traceback.print_exc()

    def finish_workflow(self, content):
        self.set_preview(content)
        self.log_write(f"\n✅ [bold green]DONE. Saved to: {self.current_file}[/]")
        self.state = WorkflowState.DONE

    @work(exclusive=True, thread=True)
    def run_refinement(self, instructions):
        try:
            self.log_write(f"🔄 [yellow]Refining...[/]")
            
            self.conversation_history.append({
                "role": "user", 
                "content": f"Rewrite previous doc. Instructions: {instructions}. Output only full doc."
            })
            
            new_content = self.engine.chat(self.conversation_history) or ""
            self.conversation_history.append({"role": "assistant", "content": new_content})
            
            if self.current_file:
                with open(self.current_file, "w", encoding="utf-8") as f: 
                    f.write(new_content)
            
            self.call_from_thread(self.finish_refinement, new_content)
        except Exception as e:
            self.log_write(f"❌ [bold red]Worker Error:[/]")
            self.log_write(f"{str(e)}")
            traceback.print_exc()

    def finish_refinement(self, content):
        self.set_preview(content)
        self.log_write("✅ [bold green]Refinement Complete.[/]")

    # =========================================================================
    # INPUT HANDLERS
    # =========================================================================

    def action_smart_action(self):
        """Bound to F5. Decides whether to Submit Message or Continue Step."""
        
        input_widget = self.query_one("#user-input", TextArea)
        val = input_widget.text.strip()

        # CASE 1: USER TYPED SOMETHING -> SUBMIT MESSAGE
        if val:
            input_widget.text = "" # Clear input
            
            # Handle Commands
            if val.lower() in ["/c", "/continue", "/next"]:
                self.run_continue_logic()
                return
            if val.lower() in ["/e", "/edit"]:
                self.action_edit_file()
                return
            if val.lower() in ["/q", "/quit"]:
                self.exit()
                return

            # Process @mentions
            injected_context = self.process_file_mentions(val)
            full_prompt = val + injected_context 

            # Route to correct state
            if self.state == WorkflowState.WAITING_SEC_INPUT:
                self.log_write(f"👤 Guidance: {val}") 
                self.run_step_5_final(full_prompt)
            elif self.state in [WorkflowState.REVIEW_PLAN, WorkflowState.REVIEW_TDD]:
                self.run_refinement(full_prompt)
            elif self.state == WorkflowState.DONE:
                self.log_write("Work complete. Press q to quit.")
            else:
                self.log_write("⚠️  [red]Please wait for AI...[/]")
        
        # CASE 2: INPUT IS EMPTY -> CONTINUE STEP
        else:
            self.run_continue_logic()

    def run_continue_logic(self):
        """Moves the state machine forward."""
        if self.state == WorkflowState.REVIEW_PLAN:
            self.run_step_2_and_3()
        elif self.state == WorkflowState.REVIEW_TDD:
            self.run_step_4_security()
        elif self.state == WorkflowState.WAITING_SEC_INPUT:
             self.log_write("⚠️  [red]Input required. Type guidance and press F5.[/]")
        else:
            self.log_write("⚠️  [yellow]Cannot continue yet (Busy or Done).[/]")

    def action_edit_file(self):
        if not self.current_file: return
        with self.suspend():
            subprocess.call([EDITOR, self.current_file])
        with open(self.current_file, "r") as f: content = f.read()
        self.set_preview(content)
        if self.conversation_history and self.conversation_history[-1]["role"] == "assistant":
            self.conversation_history[-1]["content"] = content
            self.log_write("✅ Manual edits loaded.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 main_tui.py <path_to_feature_request_file>")
        sys.exit(1)
    
    if not os.path.exists(sys.argv[1]):
        print("File not found.")
        sys.exit(1)

    with open(sys.argv[1], "r") as f:
        req_text = f.read().strip()

    app = AgentWorkflowApp(feature_request=req_text)
    app.run()