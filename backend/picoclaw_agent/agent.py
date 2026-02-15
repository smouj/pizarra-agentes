"""
PicoClaw Agent - Main agent implementation
Handles conversation loop, tool execution, and context building
"""

from typing import List, Dict, Any, Optional
from pathlib import Path
from datetime import datetime
import platform
import json

from .providers import LLMProvider, Message, ToolCall
from .tools import ToolRegistry


class ContextBuilder:
    """Builds system context and prompts for the agent"""

    def __init__(self, workspace: str, tool_registry: ToolRegistry):
        self.workspace = Path(workspace)
        self.tool_registry = tool_registry

        # Ensure workspace exists
        self.workspace.mkdir(parents=True, exist_ok=True)

        # Create memory directory
        (self.workspace / "memory").mkdir(exist_ok=True)

    def get_identity(self) -> str:
        """Get the core identity prompt"""
        now = datetime.now().strftime("%Y-%m-%d %H:%M (%A)")
        workspace_path = self.workspace.resolve()
        runtime_info = f"{platform.system()} {platform.machine()}, Python"

        # Build tools section
        tools_section = self.build_tools_section()

        return f"""# picoclaw 🦞 (Python Implementation)

You are picoclaw, a helpful AI assistant integrated into the OpenClaw MGS Codec Dashboard.

## Current Time
{now}

## Runtime
{runtime_info}

## Workspace
Your workspace is at: {workspace_path}
- Memory: {workspace_path}/memory/MEMORY.md
- Sessions: Managed by MongoDB

{tools_section}

## Important Rules

1. **ALWAYS use tools** - When you need to perform an action (execute commands, read/write files, search the web, etc.), you MUST call the appropriate tool. Do NOT just say you'll do it or pretend to do it.

2. **Be helpful and accurate** - When using tools, briefly explain what you're doing.

3. **Memory** - When remembering something important, use the memory tool to write to {workspace_path}/memory/MEMORY.md

4. **Security** - You operate in a sandboxed environment. Dangerous commands are blocked for safety.
"""

    def build_tools_section(self) -> str:
        """Build the tools section of the identity"""
        summaries = self.tool_registry.get_summaries()
        if not summaries:
            return ""

        tools_text = "## Available Tools\n\n"
        tools_text += "**CRITICAL**: You MUST use tools to perform actions. Do NOT pretend to execute commands or operations.\n\n"
        tools_text += "You have access to the following tools:\n\n"
        tools_text += "\n".join(summaries)

        return tools_text

    def load_bootstrap_files(self) -> str:
        """Load bootstrap configuration files from workspace"""
        bootstrap_files = ["IDENTITY.md", "SOUL.md", "USER.md", "AGENTS.md"]
        result = ""

        for filename in bootstrap_files:
            file_path = self.workspace / filename
            if file_path.exists():
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        result += f"## {filename}\n\n{content}\n\n"
                except Exception as e:
                    continue

        return result

    def get_memory_context(self) -> str:
        """Get recent memory context"""
        memory_file = self.workspace / "memory" / "MEMORY.md"

        if not memory_file.exists():
            return ""

        try:
            with open(memory_file, 'r', encoding='utf-8') as f:
                content = f.read()

            # Return last 2000 characters to avoid context overflow
            if len(content) > 2000:
                content = "...\n" + content[-2000:]

            return f"## Recent Memory\n\n{content}"

        except Exception:
            return ""

    def build_system_prompt(self) -> str:
        """Build the complete system prompt"""
        parts = []

        # Core identity
        parts.append(self.get_identity())

        # Bootstrap files
        bootstrap_content = self.load_bootstrap_files()
        if bootstrap_content:
            parts.append("---\n\n" + bootstrap_content)

        # Memory
        memory_context = self.get_memory_context()
        if memory_context:
            parts.append("---\n\n" + memory_context)

        return "\n".join(parts)


class PicoClawAgent:
    """Main PicoClaw Agent"""

    def __init__(
        self,
        provider: LLMProvider,
        tool_registry: ToolRegistry,
        workspace: str,
        model: Optional[str] = None,
        max_iterations: int = 10
    ):
        self.provider = provider
        self.tool_registry = tool_registry
        self.workspace = workspace
        self.model = model or provider.get_default_model()
        self.max_iterations = max_iterations
        self.context_builder = ContextBuilder(workspace, tool_registry)

    async def chat(
        self,
        user_message: str,
        history: Optional[List[Message]] = None,
        agent_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Process a chat message and return the response

        Returns:
            {
                "content": str,
                "tool_calls": List[Dict],
                "usage": Dict,
                "iterations": int,
                "tool_results": List[str]
            }
        """

        # Build messages
        messages = []

        # Add system prompt
        system_prompt = self.context_builder.build_system_prompt()
        messages.append(Message(role="system", content=system_prompt))

        # Add history if provided
        if history:
            messages.extend(history)

        # Add user message
        messages.append(Message(role="user", content=user_message))

        # Execute conversation loop
        iterations = 0
        tool_results_log = []
        final_content = ""
        total_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

        while iterations < self.max_iterations:
            iterations += 1

            # Get LLM response
            response = await self.provider.chat(
                messages=messages,
                tools=self.tool_registry.get_definitions(),
                model=self.model
            )

            # Update usage
            if response.usage:
                total_usage["prompt_tokens"] += response.usage.prompt_tokens
                total_usage["completion_tokens"] += response.usage.completion_tokens
                total_usage["total_tokens"] += response.usage.total_tokens

            # Store content
            if response.content:
                final_content = response.content

            # If no tool calls, we're done
            if not response.tool_calls:
                # Add final assistant message
                messages.append(Message(role="assistant", content=response.content))
                break

            # Add assistant message with tool calls
            tool_calls_data = [
                {
                    "id": tc.id,
                    "name": tc.name,
                    "arguments": tc.arguments
                }
                for tc in response.tool_calls
            ]
            messages.append(Message(
                role="assistant",
                content=response.content or "",
                tool_calls=tool_calls_data
            ))

            # Execute tool calls
            for tool_call in response.tool_calls:
                tool_name = tool_call.name
                tool_args = tool_call.arguments

                # Execute tool
                try:
                    result = await self.tool_registry.execute(tool_name, **tool_args)
                    tool_results_log.append({
                        "tool": tool_name,
                        "args": tool_args,
                        "result": result
                    })
                except Exception as e:
                    result = f"[ERROR] Tool execution failed: {str(e)}"
                    tool_results_log.append({
                        "tool": tool_name,
                        "args": tool_args,
                        "error": str(e)
                    })

                # Add tool result to messages
                messages.append(Message(
                    role="tool",
                    content=result,
                    tool_call_id=tool_call.id
                ))

        return {
            "content": final_content,
            "usage": total_usage,
            "iterations": iterations,
            "tool_results": tool_results_log,
            "messages": messages  # Return full message history
        }

    async def execute_tool(self, tool_name: str, **kwargs) -> str:
        """Execute a single tool directly"""
        return await self.tool_registry.execute(tool_name, **kwargs)


def create_default_agent(
    api_key: str,
    provider_type: str = "anthropic",
    workspace: str = None,
    brave_api_key: Optional[str] = None,
    model: Optional[str] = None
) -> PicoClawAgent:
    """
    Create a PicoClaw agent with default configuration

    Args:
        api_key: API key for the LLM provider
        provider_type: Type of provider ('anthropic', 'openai', 'openrouter')
        workspace: Workspace directory path
        brave_api_key: Optional Brave Search API key
        model: Optional model override

    Returns:
        Configured PicoClawAgent instance
    """
    from .providers import AnthropicProvider, OpenAIProvider, OpenRouterProvider
    from .tools import (
        ShellTool, FileSystemTool, WriteFileTool, ListFilesTool,
        WebSearchTool, MemoryTool
    )

    # Set default workspace
    if workspace is None:
        workspace = str(Path.home() / ".picoclaw" / "workspace")

    # Create provider
    if provider_type == "anthropic":
        provider = AnthropicProvider(api_key)
    elif provider_type == "openai":
        provider = OpenAIProvider(api_key)
    elif provider_type == "openrouter":
        provider = OpenRouterProvider(api_key)
    else:
        raise ValueError(f"Unknown provider type: {provider_type}")

    # Create tool registry
    tools = ToolRegistry()
    tools.register(ShellTool(workspace, sandbox=True))
    tools.register(FileSystemTool(workspace))
    tools.register(WriteFileTool(workspace))
    tools.register(ListFilesTool(workspace))
    tools.register(MemoryTool(workspace))

    if brave_api_key:
        tools.register(WebSearchTool(brave_api_key))

    # Create agent
    return PicoClawAgent(
        provider=provider,
        tool_registry=tools,
        workspace=workspace,
        model=model
    )
