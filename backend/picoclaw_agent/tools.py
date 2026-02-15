"""
Tool implementations for PicoClaw Agent
Includes: Filesystem, Shell, Web Search, and more
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
import os
import subprocess
import json
import httpx
from pathlib import Path


class Tool(ABC):
    """Base class for all tools"""

    @abstractmethod
    def get_name(self) -> str:
        """Get tool name"""
        pass

    @abstractmethod
    def get_description(self) -> str:
        """Get tool description"""
        pass

    @abstractmethod
    def get_parameters(self) -> Dict[str, Any]:
        """Get tool parameters schema (JSON Schema)"""
        pass

    @abstractmethod
    async def execute(self, **kwargs) -> str:
        """Execute the tool"""
        pass

    def get_definition(self) -> Dict[str, Any]:
        """Get tool definition in OpenAI/Anthropic format"""
        return {
            "type": "function",
            "function": {
                "name": self.get_name(),
                "description": self.get_description(),
                "parameters": self.get_parameters()
            }
        }

    def get_summary(self) -> str:
        """Get a summary description for context"""
        return f"### {self.get_name()}\n{self.get_description()}\n"


class ShellTool(Tool):
    """Execute shell commands in a sandboxed environment"""

    def __init__(self, workspace: str, sandbox: bool = True):
        self.workspace = workspace
        self.sandbox = sandbox
        self.dangerous_commands = [
            "rm -rf", "format", "shutdown", "reboot", "dd if=", "mkfs",
            ":(){ :|:& };:", "fork()", "> /dev/sda"
        ]

    def get_name(self) -> str:
        return "shell"

    def get_description(self) -> str:
        return "Execute shell commands. Use for system operations, running scripts, and automation tasks."

    def get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "The shell command to execute"
                }
            },
            "required": ["command"]
        }

    async def execute(self, command: str, **kwargs) -> str:
        """Execute a shell command"""

        # Security check
        if self.sandbox:
            for dangerous in self.dangerous_commands:
                if dangerous in command.lower():
                    return f"[ERROR] Dangerous command blocked: {dangerous}"

        try:
            # Execute command
            result = subprocess.run(
                command,
                shell=True,
                cwd=self.workspace,
                capture_output=True,
                text=True,
                timeout=30
            )

            output = result.stdout
            if result.stderr:
                output += f"\n[STDERR]\n{result.stderr}"

            if result.returncode != 0:
                output += f"\n[EXIT CODE: {result.returncode}]"

            return output if output else "[Command executed successfully with no output]"

        except subprocess.TimeoutExpired:
            return "[ERROR] Command timed out after 30 seconds"
        except Exception as e:
            return f"[ERROR] Failed to execute command: {str(e)}"


class FileSystemTool(Tool):
    """Read and write files in the workspace"""

    def __init__(self, workspace: str):
        self.workspace = workspace

    def get_name(self) -> str:
        return "read_file"

    def get_description(self) -> str:
        return "Read contents of a file in the workspace. Provide the relative path from workspace root."

    def get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Relative path to the file from workspace root"
                }
            },
            "required": ["path"]
        }

    async def execute(self, path: str, **kwargs) -> str:
        """Read a file"""
        try:
            file_path = Path(self.workspace) / path

            # Security: prevent path traversal
            if not str(file_path.resolve()).startswith(str(Path(self.workspace).resolve())):
                return "[ERROR] Access denied: path outside workspace"

            if not file_path.exists():
                return f"[ERROR] File not found: {path}"

            if not file_path.is_file():
                return f"[ERROR] Not a file: {path}"

            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            return content

        except Exception as e:
            return f"[ERROR] Failed to read file: {str(e)}"


class WriteFileTool(Tool):
    """Write content to a file"""

    def __init__(self, workspace: str):
        self.workspace = workspace

    def get_name(self) -> str:
        return "write_file"

    def get_description(self) -> str:
        return "Write or overwrite a file with the given content. Creates parent directories if needed."

    def get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Relative path to the file from workspace root"
                },
                "content": {
                    "type": "string",
                    "description": "Content to write to the file"
                }
            },
            "required": ["path", "content"]
        }

    async def execute(self, path: str, content: str, **kwargs) -> str:
        """Write a file"""
        try:
            file_path = Path(self.workspace) / path

            # Security: prevent path traversal
            if not str(file_path.resolve()).startswith(str(Path(self.workspace).resolve())):
                return "[ERROR] Access denied: path outside workspace"

            # Create parent directories
            file_path.parent.mkdir(parents=True, exist_ok=True)

            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)

            return f"[SUCCESS] File written: {path} ({len(content)} bytes)"

        except Exception as e:
            return f"[ERROR] Failed to write file: {str(e)}"


class ListFilesTool(Tool):
    """List files in a directory"""

    def __init__(self, workspace: str):
        self.workspace = workspace

    def get_name(self) -> str:
        return "list_files"

    def get_description(self) -> str:
        return "List files and directories in the workspace. Provide a relative path or leave empty for root."

    def get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Relative path from workspace root (default: root)",
                    "default": "."
                }
            }
        }

    async def execute(self, path: str = ".", **kwargs) -> str:
        """List directory contents"""
        try:
            dir_path = Path(self.workspace) / path

            # Security: prevent path traversal
            if not str(dir_path.resolve()).startswith(str(Path(self.workspace).resolve())):
                return "[ERROR] Access denied: path outside workspace"

            if not dir_path.exists():
                return f"[ERROR] Directory not found: {path}"

            if not dir_path.is_dir():
                return f"[ERROR] Not a directory: {path}"

            items = []
            for item in sorted(dir_path.iterdir()):
                item_type = "DIR" if item.is_dir() else "FILE"
                size = item.stat().st_size if item.is_file() else "-"
                items.append(f"{item_type:4} {size:>10} {item.name}")

            if not items:
                return "[Directory is empty]"

            return "\n".join(items)

        except Exception as e:
            return f"[ERROR] Failed to list directory: {str(e)}"


class WebSearchTool(Tool):
    """Search the web using Brave Search API"""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key

    def get_name(self) -> str:
        return "web_search"

    def get_description(self) -> str:
        return "Search the web for information. Returns top search results with titles, URLs, and snippets."

    def get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query"
                },
                "count": {
                    "type": "integer",
                    "description": "Number of results to return (default: 5)",
                    "default": 5
                }
            },
            "required": ["query"]
        }

    async def execute(self, query: str, count: int = 5, **kwargs) -> str:
        """Search the web"""
        if not self.api_key:
            return "[ERROR] Web search API key not configured"

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.search.brave.com/res/v1/web/search",
                    headers={
                        "Accept": "application/json",
                        "X-Subscription-Token": self.api_key
                    },
                    params={
                        "q": query,
                        "count": count
                    },
                    timeout=10.0
                )

                if response.status_code != 200:
                    return f"[ERROR] Search API returned status {response.status_code}"

                data = response.json()
                results = data.get("web", {}).get("results", [])

                if not results:
                    return "[No results found]"

                formatted_results = []
                for i, result in enumerate(results[:count], 1):
                    formatted_results.append(
                        f"{i}. {result.get('title', 'No title')}\n"
                        f"   URL: {result.get('url', '')}\n"
                        f"   {result.get('description', 'No description')}"
                    )

                return "\n\n".join(formatted_results)

        except Exception as e:
            return f"[ERROR] Search failed: {str(e)}"


class MemoryTool(Tool):
    """Read and write to long-term memory"""

    def __init__(self, workspace: str):
        self.workspace = workspace
        self.memory_file = Path(workspace) / "memory" / "MEMORY.md"

    def get_name(self) -> str:
        return "memory"

    def get_description(self) -> str:
        return "Read or append to long-term memory. Use this to remember important information across sessions."

    def get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["read", "append"],
                    "description": "Action to perform: 'read' or 'append'"
                },
                "content": {
                    "type": "string",
                    "description": "Content to append (required for 'append' action)"
                }
            },
            "required": ["action"]
        }

    async def execute(self, action: str, content: str = "", **kwargs) -> str:
        """Read or write memory"""
        try:
            # Ensure memory directory exists
            self.memory_file.parent.mkdir(parents=True, exist_ok=True)

            if action == "read":
                if not self.memory_file.exists():
                    return "[Memory is empty]"

                with open(self.memory_file, 'r', encoding='utf-8') as f:
                    return f.read()

            elif action == "append":
                if not content:
                    return "[ERROR] Content required for append action"

                with open(self.memory_file, 'a', encoding='utf-8') as f:
                    from datetime import datetime
                    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    f.write(f"\n\n---\n[{timestamp}]\n{content}\n")

                return "[SUCCESS] Memory updated"

            else:
                return f"[ERROR] Invalid action: {action}"

        except Exception as e:
            return f"[ERROR] Memory operation failed: {str(e)}"


class ToolRegistry:
    """Registry to manage all tools"""

    def __init__(self):
        self.tools: Dict[str, Tool] = {}

    def register(self, tool: Tool):
        """Register a new tool"""
        self.tools[tool.get_name()] = tool

    def get(self, name: str) -> Optional[Tool]:
        """Get a tool by name"""
        return self.tools.get(name)

    def get_definitions(self) -> List[Dict[str, Any]]:
        """Get all tool definitions for LLM"""
        return [tool.get_definition() for tool in self.tools.values()]

    def get_summaries(self) -> List[str]:
        """Get summaries of all tools"""
        return [tool.get_summary() for tool in self.tools.values()]

    def list_tools(self) -> List[str]:
        """List all tool names"""
        return list(self.tools.keys())

    async def execute(self, name: str, **kwargs) -> str:
        """Execute a tool by name"""
        tool = self.get(name)
        if not tool:
            return f"[ERROR] Tool not found: {name}"

        return await tool.execute(**kwargs)
