# PicoClaw Agent - Python Implementation

A lightweight AI agent framework inspired by [github.com/sipeed/picoclaw](https://github.com/sipeed/picoclaw).

## Features

- 🤖 **Multi-LLM Support**: Anthropic Claude, OpenAI GPT, OpenRouter
- 🛠️ **Executable Tools**: Shell commands, file operations, web search, memory
- 🔄 **Agentic Loop**: Autonomous tool execution with multi-step reasoning
- 🔒 **Sandboxed Security**: Dangerous command blocking, path traversal protection
- 💾 **Memory System**: Long-term memory persistence across sessions
- 📊 **Usage Tracking**: Token counting and cost estimation

## Quick Start

```python
from picoclaw_agent import create_default_agent

# Create agent
agent = create_default_agent(
    api_key="your-api-key",
    provider_type="anthropic",  # or "openai", "openrouter"
    workspace="/path/to/workspace"
)

# Chat
response = await agent.chat(
    user_message="List all Python files in the current directory"
)

print(response["content"])
print(response["tool_results"])
print(response["usage"])
```

## Architecture

### Modules

- **agent.py**: Main agent and context builder
- **providers.py**: LLM provider implementations
- **tools.py**: Executable tool implementations

### Providers

- `AnthropicProvider`: Anthropic Claude API
- `OpenAIProvider`: OpenAI GPT API
- `OpenRouterProvider`: OpenRouter API (OpenAI-compatible)

### Tools

- `ShellTool`: Execute shell commands
- `FileSystemTool`: Read files
- `WriteFileTool`: Write files
- `ListFilesTool`: List directory contents
- `WebSearchTool`: Search the web (Brave Search)
- `MemoryTool`: Read/append to long-term memory

## Usage

### Basic Chat

```python
agent = create_default_agent(
    api_key="sk-ant-api03-xxxxx",
    provider_type="anthropic"
)

response = await agent.chat(
    user_message="What is the capital of France?"
)

print(response["content"])
# "The capital of France is Paris."
```

### With Tool Execution

```python
response = await agent.chat(
    user_message="Create a file called hello.txt with 'Hello World'"
)

print(response["content"])
# "I'll create the file for you."

print(response["tool_results"])
# [{"tool": "write_file", "args": {...}, "result": "File written..."}]
```

### With Conversation History

```python
from picoclaw_agent.providers import Message

history = [
    Message(role="user", content="My name is Alice"),
    Message(role="assistant", content="Nice to meet you, Alice!"),
]

response = await agent.chat(
    user_message="What's my name?",
    history=history
)

print(response["content"])
# "Your name is Alice."
```

## Configuration

### Environment Variables

```env
BRAVE_API_KEY=BSA...  # Optional: for web search
```

### Custom Configuration

```python
from picoclaw_agent import PicoClawAgent, ToolRegistry
from picoclaw_agent.providers import AnthropicProvider
from picoclaw_agent.tools import ShellTool, FileSystemTool

# Custom provider
provider = AnthropicProvider(api_key="sk-ant-...")

# Custom tools
tools = ToolRegistry()
tools.register(ShellTool(workspace="/tmp", sandbox=True))
tools.register(FileSystemTool(workspace="/tmp"))

# Custom agent
agent = PicoClawAgent(
    provider=provider,
    tool_registry=tools,
    workspace="/tmp",
    model="claude-3-opus-20240229",
    max_iterations=15
)
```

## Security

### Sandboxing

All tools run in a sandboxed environment:

- File operations restricted to workspace
- Path traversal prevented
- Dangerous commands blocked

### Blocked Commands

- `rm -rf` (recursive delete)
- `format` (disk formatting)
- `shutdown` / `reboot`
- `dd if=` (disk operations)
- `mkfs` (filesystem creation)
- Fork bombs

## Development

### Running Tests

```python
import asyncio
from picoclaw_agent import create_default_agent

async def test():
    agent = create_default_agent(
        api_key="sk-ant-api03-xxxxx",
        provider_type="anthropic",
        workspace="/tmp/test"
    )

    # Test shell tool
    result = await agent.execute_tool("shell", command="echo 'Hello'")
    print(result)

    # Test full chat
    response = await agent.chat(
        user_message="List files and create a test file"
    )
    print(response)

asyncio.run(test())
```

## License

MIT License - Same as parent project

## Credits

Inspired by [PicoClaw](https://github.com/sipeed/picoclaw) by Sipeed.
