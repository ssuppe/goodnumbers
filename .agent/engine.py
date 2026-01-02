import os
import sys
import json
from openai import OpenAI
from tools import TOOL_SCHEMAS, AVAILABLE_FUNCTIONS

class AgentEngine:
    def __init__(self):
        self.base_url = os.environ.get("OPENAI_API_BASE", "http://localhost:2048/v1")
        self.api_key = os.environ.get("OPENAI_API_KEY", "dummy-key")
        self.model = os.environ.get("AGENT_MODEL", "gemini-3-pro-preview")
        
        try:
            self.client = OpenAI(base_url=self.base_url, api_key=self.api_key)
        except Exception as e:
            print(f"❌ Failed to init OpenAI client: {e}")
            sys.exit(1)

    def chat(self, messages, temperature=0.2):
        """
        Sends messages to the LLM. Handles Tool Calling automatically.
        """
        # Make a copy so we don't mutate the global history during the tool loop
        current_messages = list(messages)
        
        while True:
            try:
                # 1. Send Request
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=current_messages,
                    temperature=temperature,
                    tools=TOOL_SCHEMAS, # <--- Pass our tools here
                    tool_choice="auto"
                )
                
                response_message = response.choices[0].message
                
                # 2. Check if the AI wants to use a tool
                tool_calls = response_message.tool_calls
                
                if tool_calls:
                    # AI wants to act. We must append its "thought" to history first.
                    current_messages.append(response_message)
                    
                    print(f"   ⚙️  AI is using tools...")

                    # 3. Execute the requested tools
                    for tool_call in tool_calls:
                        function_name = tool_call.function.name
                        function_args = json.loads(tool_call.function.arguments)
                        
                        if function_name in AVAILABLE_FUNCTIONS:
                            function_to_call = AVAILABLE_FUNCTIONS[function_name]
                            
                            print(f"      Running: {function_name}({function_args})")
                            
                            function_response = function_to_call(**function_args)
                            
                            # 4. Feed result back to AI
                            current_messages.append(
                                {
                                    "tool_call_id": tool_call.id,
                                    "role": "tool",
                                    "name": function_name,
                                    "content": str(function_response),
                                }
                            )
                        else:
                            # Handle weird hallucinations
                            current_messages.append(
                                {
                                    "tool_call_id": tool_call.id,
                                    "role": "tool",
                                    "name": function_name,
                                    "content": f"Error: Function {function_name} not found.",
                                }
                            )
                    # Loop back to top! The AI will now see the tool output and generate a text response.
                    continue 

                # 5. No tools used? Return the text response.
                return response_message.content

            except Exception as e:
                return f"❌ Error in AgentEngine: {str(e)}"