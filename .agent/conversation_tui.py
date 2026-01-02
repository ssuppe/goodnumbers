import os
import sys
import subprocess
from textual.app import App, ComposeResult
from textual.containers import Horizontal, Vertical
from textual.widgets import Header, Footer, Input, RichLog, MarkdownViewer
from textual.worker import Worker, WorkerState
from textual import work

# --- EXISTING IMPORTS (Keep your local files) ---
# Assuming these exist in your project structure
try:
    from engine import AgentEngine
    from context import build_full_context
except ImportError:
    # Fallback for demonstration if files are missing
    print("⚠️  Could not import engine/context. Make sure you are in the project root.")
    sys.exit(1)

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
CURRENT_FILE_PATH = os.path.join(OUTPUT_DIR, "current_output.md")
EDITOR = os.environ.get("EDITOR", "nano")

def setup_dirs():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

def load_prompt(name, **kwargs):
    path = os.path.join(os.path.dirname(__file__), "prompts", name)
    try:
        with open(path, "r") as f:
            return f.read().format(**kwargs)
    except FileNotFoundError:
        return "" # Handle gracefully for now

class AgentApp(App):
    """A Textual app to manage the AI Agent conversation."""

    # CSS for layout: 40% width for chat (left), rest for preview (right)
    CSS = """
    Screen {
        layout: horizontal;
    }
    #left-pane {
        width: 40%;
        height: 100%;
        border-right: solid $accent;
    }
    #right-pane {
        width: 60%;
        height: 100%;
    }
    #chat-log {
        height: 1fr; 
        border-bottom: solid $secondary;
    }
    #user-input {
        height: 3;
        dock: bottom;
    }
    """

    # Key bindings shown in the footer
    BINDINGS = [
        ("q", "quit", "Quit"),
        ("e", "edit_file", "Edit File in External Editor"),
        ("r", "retry_last", "Retry Last Response"),
    ]

    def __init__(self, initial_prompt, **kwargs):
        super().__init__(**kwargs)
        self.initial_prompt = initial_prompt
        self.engine = AgentEngine()
        self.conversation_history = []
        self.project_root = os.getcwd()

    def compose(self) -> ComposeResult:
        """Create the UI layout."""
        yield Header()
        
        # Left Pane: Chat Log + Input Box
        with Vertical(id="left-pane"):
            # CHANGED: Use RichLog with wrap and markup enabled
            yield RichLog(
                id="chat-log", 
                highlight=True, 
                markup=True, 
                wrap=True
            )
            yield Input(placeholder="Type instructions here...", id="user-input")
        
        # Right Pane: Markdown Viewer
        yield MarkdownViewer(id="right-pane", show_table_of_contents=False)
        
        yield Footer()

    def on_mount(self) -> None:
        """Called when app starts. Sets up context and kicks off first run."""
        setup_dirs()
        self.log_write("🤖 [bold green]System initializing...[/]")

        # 1. Build Context
        static_context = build_full_context(self.project_root)
        sys_persona = load_prompt("0_system_base.txt")
        tool_instructions = (
            "\n\nYou have access to tools to read the file system. "
            "If the user asks about a file you haven't seen, DO NOT hallucinate. "
            "Use 'list_files' or 'read_file' to check the real content first."
        )
        full_system_msg = f"{sys_persona}{tool_instructions}\n\n{static_context}"

        # 2. Initialize History
        self.conversation_history = [
            {"role": "system", "content": full_system_msg},
            {"role": "user", "content": self.initial_prompt}
        ]
        
        self.log_write(f"📄 User Request: {self.initial_prompt}")
        
        # 3. Trigger the AI (Run in background so UI doesn't freeze)
        self.run_ai_generation()

    def log_write(self, message: str):
        """Helper to write to the log widget on the left."""
        # CHANGED: Query for RichLog instead of Log
        log_widget = self.query_one("#chat-log", RichLog)
        log_widget.write(message)

    @work(exclusive=True, thread=True)
    def run_ai_generation(self):
        """Runs the blocking AI engine in a background thread."""
        self.call_from_thread(self.log_write, "🤖 [yellow]Thinking...[/]")
        
        # Call the engine (Blocking operation)
        try:
            response = self.engine.chat(self.conversation_history)
        except Exception as e:
            self.call_from_thread(self.log_write, f"❌ [bold red]Error:[/]{str(e)}")
            return

        # Update History
        self.conversation_history.append({"role": "assistant", "content": response})

        # Save to File
        with open(CURRENT_FILE_PATH, "w", encoding="utf-8") as f:
            f.write(response)

        # Update UI (Must be done on main thread)
        self.call_from_thread(self.update_ui_after_response, response)

    def update_ui_after_response(self, response_text):
        """Updates the Markdown viewer and Log after AI finishes."""
        self.log_write("🤖 [bold green]Done.[/]")
        
        # Update Markdown View
        viewer = self.query_one("#right-pane", MarkdownViewer)
        viewer.document.update(response_text)
        
        # Focus input for next command
        self.query_one("#user-input", Input).focus()

    async def on_input_submitted(self, event: Input.Submitted):
        """Handle user hitting Enter in the input box."""
        user_msg = event.value.strip()
        if not user_msg:
            return

        # Clear input
        event.input.value = ""
        
        self.log_write(f"👤 [bold blue]You:[/]{user_msg}")
        self.conversation_history.append({"role": "user", "content": user_msg})
        
        # Run AI
        self.run_ai_generation()

    def action_edit_file(self):
        """Action for [e] key: Open external editor."""
        self.log_write(f"✏️  Opening {EDITOR}...")
        
        # We must 'suspend' the TUI to let the terminal show the editor
        with self.suspend():
            subprocess.call([EDITOR, CURRENT_FILE_PATH])

        # After closing editor, reload the content
        with open(CURRENT_FILE_PATH, "r", encoding="utf-8") as f:
            new_content = f.read()

        # Update AI memory
        if self.conversation_history and self.conversation_history[-1]["role"] == "assistant":
            self.conversation_history[-1]["content"] = new_content
            self.log_write("✅ AI memory updated with manual edits.")
        
        # Update Preview
        viewer = self.query_one("#right-pane", MarkdownViewer)
        viewer.document.update(new_content)

    def action_retry_last(self):
        """Action for [r] key: Retry generation."""
        if not self.conversation_history:
            return
            
        # Remove last assistant message
        if self.conversation_history[-1]["role"] == "assistant":
            self.conversation_history.pop()
            self.log_write("🔄 Discarding last response and retrying...")
            self.run_ai_generation()
        else:
            self.log_write("⚠️  Cannot retry: Last message was not from AI.")

if __name__ == "__main__":
    # Handle Input Arguments
    if len(sys.argv) < 2:
        print("Usage: python3 conversation_tui.py <request_file_or_text>")
        sys.exit(1)

    input_arg = sys.argv[1]
    if os.path.exists(input_arg):
        with open(input_arg, "r", encoding="utf-8") as f:
            initial_prompt = f.read().strip()
    else:
        initial_prompt = input_arg

    # Run the App
    app = AgentApp(initial_prompt=initial_prompt)
    app.run()