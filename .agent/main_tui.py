import os
import sys
import subprocess
import traceback # Added for debugging
from enum import Enum, auto
from textual.app import App, ComposeResult
from textual.containers import Vertical
from textual.widgets import Header, Footer, Input, RichLog, MarkdownViewer
from textual import work

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
EDITOR = os.environ.get("EDITOR", "nano")

def setup_dirs():
    os.makedirs(DRAFT_DIR, exist_ok=True)
    os.makedirs(FINAL_DIR, exist_ok=True)
    # Return absolute path for logging
    return os.path.abspath(DRAFT_DIR)

def load_prompt(name, **kwargs):
    path = os.path.join(os.path.dirname(__file__), "prompts", name)
    try:
        with open(path, "r") as f:
            return f.read().format(**kwargs)
    except FileNotFoundError:
        # Raise error so the UI logs it clearly
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
    #chat-log { height: 1fr; border-bottom: solid $secondary; }
    #user-input { height: 3; dock: bottom; }
    """

    BINDINGS = [
        ("q", "quit", "Quit"),
        ("f5", "continue_step", "Continue (Next Step)"), # Mapped to action_continue_step
        ("f2", "edit_file", "Edit Current File"),        # Mapped to action_edit_file
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
            # wrap=True ensures long errors don't get hidden
            yield RichLog(id="chat-log", highlight=True, markup=True, wrap=True)
            yield Input(placeholder="Type instructions (or /c to continue)...", id="user-input")
        yield MarkdownViewer(id="right-pane", show_table_of_contents=False)
        yield Footer()

    def on_mount(self):
        self.draft_abs_path = setup_dirs()
        self.log_write("🤖 [bold green]Workflow Initializing...[/]")
        self.log_write(f"📂 Saving files to: [u]{self.draft_abs_path}[/]")
        self.log_write(f"📄 Request size: {len(self.feature_request)} chars")
        
        self.run_step_1_plan()

    def log_write(self, msg):
        self.query_one("#chat-log", RichLog).write(msg)

    def set_preview(self, content):
        self.query_one("#right-pane", MarkdownViewer).document.update(content)

    # =========================================================================
    # WORKER METHODS (Protected with Try/Except)
    # =========================================================================

    @work(exclusive=True, thread=True)
    def run_step_1_plan(self):
        try:
            self.state = WorkflowState.GENERATING_PLAN
            self.call_from_thread(self.log_write, "\n🚀 [bold yellow][Step 1] Generating Plan...[/]")
            
            static_context = build_full_context(self.project_root)
            sys_prompt = load_prompt("0_system_base.txt")
            step1_prompt = load_prompt("1_init_plan.txt", manager_request=self.feature_request)
            
            self.conversation_history = [
                {"role": "system", "content": sys_prompt + "\n" + static_context},
                {"role": "user", "content": step1_prompt}
            ]

            # Removed temperature arg to be safe
            plan_v1 = self.engine.chat(self.conversation_history)
            self.conversation_history.append({"role": "assistant", "content": plan_v1})
            
            self.current_file = os.path.join(DRAFT_DIR, "v1_initial.md")
            with open(self.current_file, "w", encoding="utf-8") as f: 
                f.write(plan_v1)
            
            self.call_from_thread(self.finish_step_1, plan_v1)
        
        except Exception as e:
            self.call_from_thread(self.handle_worker_error, e)

    def finish_step_1(self, content):
        self.set_preview(content)
        self.log_write(f"✅ [bold green]Saved: {self.current_file}[/]")
        self.log_write("👉 [bold cyan]Gate:[/]")
        self.log_write("   • Type feedback + Enter to Refine")
        self.log_write("   • Type [bold]/c[/] or Press [bold]F5[/] to Continue")
        self.state = WorkflowState.REVIEW_PLAN

    @work(exclusive=True, thread=True)
    def run_step_2_and_3(self):
        try:
            self.state = WorkflowState.GENERATING_CRITIQUE
            self.call_from_thread(self.log_write, "\n🧐 [bold yellow][Step 2] Auto-Critique...[/]")
            
            self.conversation_history.append({"role": "user", "content": load_prompt("2_critique.txt")})
            critique = self.engine.chat(self.conversation_history)
            self.conversation_history.append({"role": "assistant", "content": critique})
            
            # Save critique just in case
            with open(os.path.join(DRAFT_DIR, "v2_critique.md"), "w", encoding="utf-8") as f: 
                f.write(critique)
            
            self.call_from_thread(self.set_preview, critique)

            # Step 3
            self.state = WorkflowState.GENERATING_TDD
            self.call_from_thread(self.log_write, "\n🧪 [bold yellow][Step 3] Enforcing TDD...[/]")
            
            self.conversation_history.append({"role": "user", "content": load_prompt("3_tdd_enforce.txt")})
            plan_v3 = self.engine.chat(self.conversation_history)
            self.conversation_history.append({"role": "assistant", "content": plan_v3})
            
            self.current_file = os.path.join(DRAFT_DIR, "v3_tdd.md")
            with open(self.current_file, "w", encoding="utf-8") as f: 
                f.write(plan_v3)
            
            self.call_from_thread(self.finish_step_3, plan_v3)

        except Exception as e:
            self.call_from_thread(self.handle_worker_error, e)

    def finish_step_3(self, content):
        self.set_preview(content)
        self.log_write(f"✅ [bold green]Saved: {self.current_file}[/]")
        self.log_write("👉 [bold cyan]Gate:[/] Refine or Continue (/c).")
        self.state = WorkflowState.REVIEW_TDD

    @work(exclusive=True, thread=True)
    def run_step_4_security(self):
        try:
            self.state = WorkflowState.GENERATING_SEC
            self.call_from_thread(self.log_write, "\n🛡️  [bold yellow][Step 4] Security Review...[/]")
            
            self.conversation_history.append({"role": "user", "content": load_prompt("4_sec_review.txt")})
            sec_feedback = self.engine.chat(self.conversation_history)
            self.conversation_history.append({"role": "assistant", "content": sec_feedback})
            
            self.call_from_thread(self.finish_step_4, sec_feedback)
        except Exception as e:
            self.call_from_thread(self.handle_worker_error, e)

    def finish_step_4(self, content):
        self.set_preview(content)
        self.log_write("\n🛑 [bold red]Security Findings Above.[/]")
        self.log_write("👉 [bold white]Action Required:[/] Type guidance for final rewrite + Enter.")
        self.state = WorkflowState.WAITING_SEC_INPUT

    @work(exclusive=True, thread=True)
    def run_step_5_final(self, user_guidance):
        try:
            self.state = WorkflowState.GENERATING_FINAL
            self.call_from_thread(self.log_write, "\n✍️  [bold yellow][Step 5] Finalizing...[/]")
            
            final_prompt = load_prompt("5_sec_rewrite.txt", user_notes=user_guidance)
            self.conversation_history.append({"role": "user", "content": final_prompt})
            
            final_spec = self.engine.chat(self.conversation_history)
            
            self.current_file = os.path.join(FINAL_DIR, "final_spec.md")
            with open(self.current_file, "w", encoding="utf-8") as f: 
                f.write(final_spec)
            
            self.call_from_thread(self.finish_workflow, final_spec)
        except Exception as e:
            self.call_from_thread(self.handle_worker_error, e)

    def finish_workflow(self, content):
        self.set_preview(content)
        self.log_write(f"\n✅ [bold green]DONE. Saved to: {self.current_file}[/]")
        self.state = WorkflowState.DONE

    @work(exclusive=True, thread=True)
    def run_refinement(self, instructions):
        try:
            self.call_from_thread(self.log_write, f"🔄 [yellow]Refining...[/]")
            
            self.conversation_history.append({
                "role": "user", 
                "content": f"Rewrite previous doc. Instructions: {instructions}. Output only full doc."
            })
            
            new_content = self.engine.chat(self.conversation_history)
            self.conversation_history.append({"role": "assistant", "content": new_content})
            
            if self.current_file:
                with open(self.current_file, "w", encoding="utf-8") as f: 
                    f.write(new_content)
            
            self.call_from_thread(self.finish_refinement, new_content)
        except Exception as e:
            self.call_from_thread(self.handle_worker_error, e)

    def finish_refinement(self, content):
        self.set_preview(content)
        self.log_write("✅ [bold green]Refinement Complete.[/]")

    def handle_worker_error(self, e):
        """Displays errors in the UI Log so they aren't silent."""
        self.log_write(f"❌ [bold red]ERROR:[/]")
        self.log_write(f"{str(e)}")
        # Print traceback to console just in case
        traceback.print_exc()

    # =========================================================================
    # INPUT HANDLERS
    # =========================================================================

    def on_input_submitted(self, event: Input.Submitted):
        val = event.value.strip()
        event.input.value = ""
        if not val: return

        # Slash Commands
        if val.lower() in ["/c", "/continue", "/next"]:
            self.action_continue_step()
            return
        if val.lower() in ["/e", "/edit"]:
            self.action_edit_file()
            return
        if val.lower() in ["/q", "/quit"]:
            self.exit()
            return

        # Context Aware Input
        if self.state == WorkflowState.WAITING_SEC_INPUT:
            self.log_write(f"👤 Guidance: {val}")
            self.run_step_5_final(val)
        elif self.state in [WorkflowState.REVIEW_PLAN, WorkflowState.REVIEW_TDD]:
            self.run_refinement(val)
        elif self.state == WorkflowState.DONE:
            self.log_write("Work complete. Press q to quit.")
        else:
            self.log_write("⚠️  [red]Please wait for AI...[/]")

    def action_continue_step(self):
        """Bound to F5"""
        if self.state == WorkflowState.REVIEW_PLAN:
            self.run_step_2_and_3()
        elif self.state == WorkflowState.REVIEW_TDD:
            self.run_step_4_security()
        elif self.state == WorkflowState.WAITING_SEC_INPUT:
             self.log_write("⚠️  [red]Type guidance and press Enter.[/]")
        else:
            self.log_write("⚠️  [yellow]Cannot continue yet.[/]")

    def action_edit_file(self):
        """Bound to F2"""
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