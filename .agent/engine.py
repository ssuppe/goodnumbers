import os
import sys
import json
import datetime
from openai import OpenAI
from tools import TOOL_SCHEMAS, AVAILABLE_FUNCTIONS

# --- SIMPLE FILE LOGGER ---
def log_debug(msg):
    timestamp = datetime.datetime.now().strftime("%H:%M:%S")
    with open("engine_debug.log", "a", encoding="utf-8") as f:
        f.write(f"[{timestamp}] {msg}\n")

class AgentEngine:
    def __init__(self):
        self.base_url = os.environ.get("OPENAI_API_BASE", "http://localhost:2048/v1")
        self.api_key = os.environ.get("OPENAI_API_KEY", "dummy-key")
        self.model = os.environ.get("AGENT_MODEL", "gemini-3-pro-preview")
        
        log_debug(f"🔌 INIT: {self.model} @ {self.base_url}")
        
        try:
            self.client = OpenAI(base_url=self.base_url, api_key=self.api_key)
        except Exception as e:
            log_debug(f"❌ Failed to init OpenAI client: {e}")
            sys.exit(1)

    def chat(self, messages, temperature=0.2):
        current_messages = list(messages)
        MAX_TOOL_LOOPS = 5
        loop_count = 0

        while loop_count < MAX_TOOL_LOOPS:
            loop_count += 1
            try:
                log_debug(f"📤 Sending Request (Turn {loop_count})...")
                
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=current_messages,
                    temperature=temperature,
                    tools=TOOL_SCHEMAS,
                    tool_choice="auto" 
                )
                
                msg = response.choices[0].message
                content_len = len(msg.content) if msg.content else 0
                tool_calls_len = len(msg.tool_calls) if msg.tool_calls else 0
                
                log_debug(f"📥 RECEIVED: Text={content_len} chars | Tools={tool_calls_len}")

                # 2. Handle Tool Calls
                if msg.tool_calls:
                    log_debug(f"⚙️  AI wants to use {len(msg.tool_calls)} tool(s)")
                    
                    current_messages.append(msg)

                    for tool_call in msg.tool_calls:
                        fn_name = tool_call.function.name
                        fn_args = tool_call.function.arguments
                        
                        log_debug(f"   👉 Executing: {fn_name}({fn_args})")
                        
                        if fn_name in AVAILABLE_FUNCTIONS:
                            try:
                                args_dict = json.loads(fn_args)
                                result = AVAILABLE_FUNCTIONS[fn_name](**args_dict)
                            except Exception as e:
                                result = f"Error executing tool: {e}"
                        else:
                            result = f"Error: Tool '{fn_name}' not found."

                        log_debug(f"   ✅ Result: {str(result)[:100]}...")
                        
                        current_messages.append({
                            "tool_call_id": tool_call.id,
                            "role": "tool",
                            "name": fn_name,
                            "content": str(result)
                        })
                    
                    continue # Loop back

                # 3. Handle Final Response
                content = msg.content
                if not content:
                    log_debug("❌ CRITICAL: AI returned NO content and NO tools.")
                    log_debug(f"Full Dump: {msg}")
                    return "⚠️ Error: AI returned empty response. See engine_debug.log."
                
                return content

            except Exception as e:
                log_debug(f"❌ EXCEPTION: {e}")
                return f"❌ Error: {str(e)}"
        
        return "⚠️ Error: Max tool loops exceeded."