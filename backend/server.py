from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from cryptography.fernet import Fernet
import os
import uuid
import httpx
import json

# PicoClaw Agent Integration
from picoclaw_agent import create_default_agent
from picoclaw_agent.providers import Message as PicoMessage

app = FastAPI(title="OpenClaw MGS Codec API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB setup
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017/openclaw_db")
client = AsyncIOMotorClient(MONGO_URL)
db = client.openclaw_db

# Encryption for API keys
SECRET_KEY = os.getenv("SECRET_KEY", Fernet.generate_key().decode())
cipher_suite = Fernet(SECRET_KEY.encode() if len(SECRET_KEY) == 44 else Fernet.generate_key())

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

manager = ConnectionManager()

# Pydantic models
class Agent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: str
    status: str = "offline"  # connected, busy, alert, offline
    avatar: str = "default"
    frequency: str = "187.89"
    last_activity: Optional[datetime] = None
    capabilities: List[str] = []
    description: str = ""

class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conversation_id: str
    role: str  # user, agent, system
    content: str
    agent_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = {}

class Conversation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    agent_id: str
    title: str = "New Codec Call"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    messages: List[Message] = []
    metrics: Dict[str, Any] = {
        "tokens_used": 0,
        "cost": 0.0,
        "duration": 0,
        "status": "active"
    }

class UserConfig(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    openclaw_token: Optional[str] = None
    settings: Dict[str, Any] = {
        "sound_enabled": True,
        "effects_enabled": True,
        "auto_save": True
    }
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Metrics(BaseModel):
    tokens_per_minute: float = 0.0
    cost_per_hour: float = 0.0
    active_agents: int = 0
    total_conversations: int = 0
    memory_usage: float = 0.0
    uptime: str = "00:00:00"

# Initialize default agents
DEFAULT_AGENTS = [
    {
        "name": "Orchestrator",
        "type": "orchestrator",
        "status": "connected",
        "avatar": "commander",
        "frequency": "187.89",
        "capabilities": ["coordination", "task_delegation", "strategy"],
        "description": "Central command unit for multi-agent coordination"
    },
    {
        "name": "Shell Executor",
        "type": "shell",
        "status": "connected",
        "avatar": "tech",
        "frequency": "141.12",
        "capabilities": ["bash", "system_commands", "automation"],
        "description": "Terminal operations and system command execution"
    },
    {
        "name": "Browser Agent",
        "type": "browser",
        "status": "offline",
        "avatar": "scout",
        "frequency": "140.85",
        "capabilities": ["web_scraping", "automation", "research"],
        "description": "Web navigation and data extraction specialist"
    },
    {
        "name": "File Manager",
        "type": "file",
        "status": "connected",
        "avatar": "intel",
        "frequency": "140.15",
        "capabilities": ["file_ops", "search", "organization"],
        "description": "File system operations and data management"
    },
    {
        "name": "Communications",
        "type": "messaging",
        "status": "busy",
        "avatar": "comms",
        "frequency": "142.52",
        "capabilities": ["email", "messaging", "notifications"],
        "description": "Multi-channel communication handler"
    },
    {
        "name": "Custom Skill",
        "type": "custom",
        "status": "offline",
        "avatar": "specialist",
        "frequency": "143.74",
        "capabilities": ["custom_tasks", "plugins", "extensions"],
        "description": "Specialized custom skill execution unit"
    }
]

@app.on_event("startup")
async def startup_event():
    # Initialize default agents if not exists
    existing_agents = await db.agents.count_documents({})
    if existing_agents == 0:
        for agent_data in DEFAULT_AGENTS:
            agent = Agent(**agent_data)
            await db.agents.insert_one(agent.dict())
    print("🦞 OpenClaw MGS Codec API initialized - FREQUENCY 187.89 MHz")

@app.get("/api/health")
async def health_check():
    return {"status": "operational", "frequency": "187.89 MHz", "codec": "active"}

# Agent endpoints
@app.get("/api/agents", response_model=List[Agent])
async def get_agents():
    agents = await db.agents.find().to_list(100)
    return [Agent(**agent) for agent in agents]

@app.get("/api/agents/{agent_id}", response_model=Agent)
async def get_agent(agent_id: str):
    agent = await db.agents.find_one({"id": agent_id})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return Agent(**agent)

@app.put("/api/agents/{agent_id}/status")
async def update_agent_status(agent_id: str, status: str):
    result = await db.agents.update_one(
        {"id": agent_id},
        {"$set": {"status": status, "last_activity": datetime.utcnow()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Broadcast status change
    await manager.broadcast({
        "type": "agent_status",
        "agent_id": agent_id,
        "status": status
    })
    
    return {"success": True, "agent_id": agent_id, "status": status}

# Conversation endpoints
@app.post("/api/conversations", response_model=Conversation)
async def create_conversation(agent_id: str, title: Optional[str] = "New Codec Call"):
    conversation = Conversation(agent_id=agent_id, title=title)
    await db.conversations.insert_one(conversation.dict())
    return conversation

@app.get("/api/conversations", response_model=List[Conversation])
async def get_conversations():
    conversations = await db.conversations.find().sort("updated_at", -1).limit(50).to_list(50)
    return [Conversation(**conv) for conv in conversations]

@app.get("/api/conversations/{conversation_id}", response_model=Conversation)
async def get_conversation(conversation_id: str):
    conversation = await db.conversations.find_one({"id": conversation_id})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return Conversation(**conversation)

# Message endpoints
@app.post("/api/conversations/{conversation_id}/messages")
async def send_message(conversation_id: str, role: str, content: str, agent_id: Optional[str] = None):
    conversation = await db.conversations.find_one({"id": conversation_id})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    message = Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
        agent_id=agent_id or conversation.get("agent_id")
    )
    
    # Add message to conversation
    await db.conversations.update_one(
        {"id": conversation_id},
        {
            "$push": {"messages": message.dict()},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    # If user message, get PicoClaw response
    if role == "user":
        config = await db.config.find_one({})
        if config and config.get("openclaw_token"):
            try:
                # Decrypt token
                encrypted_token = config["openclaw_token"]
                openclaw_token = cipher_suite.decrypt(encrypted_token.encode()).decode()

                # Get conversation history
                history = conversation.get("messages", [])

                # Call PicoClaw Agent
                agent_result = await call_openclaw_agent(
                    token=openclaw_token,
                    agent_id=conversation.get("agent_id"),
                    message=content,
                    conversation_history=history
                )

                # Extract response
                agent_content = agent_result.get("content", "Agent response received")
                usage = agent_result.get("usage", {})
                tool_results = agent_result.get("tool_results", [])

                # Format tool results in content if any
                if tool_results:
                    tools_summary = "\n\n[Tools used: " + ", ".join([t.get("tool", "unknown") for t in tool_results]) + "]"
                    agent_content += tools_summary

                # Add agent response
                response_message = Message(
                    conversation_id=conversation_id,
                    role="agent",
                    content=agent_content,
                    agent_id=conversation.get("agent_id"),
                    metadata={
                        "usage": usage,
                        "tool_results": tool_results,
                        "iterations": agent_result.get("iterations", 1)
                    }
                )

                # Update conversation metrics
                tokens_used = usage.get("total_tokens", 0)
                await db.conversations.update_one(
                    {"id": conversation_id},
                    {
                        "$push": {"messages": response_message.dict()},
                        "$set": {"updated_at": datetime.utcnow()},
                        "$inc": {"metrics.tokens_used": tokens_used}
                    }
                )

                # Broadcast new message
                await manager.broadcast({
                    "type": "new_message",
                    "conversation_id": conversation_id,
                    "message": response_message.dict()
                })

            except Exception as e:
                import traceback
                error_detail = traceback.format_exc()
                print(f"PicoClaw Agent error: {error_detail}")

                # Send error message
                error_message = Message(
                    conversation_id=conversation_id,
                    role="system",
                    content=f"[ERROR] Agent failed: {str(e)}",
                    agent_id=conversation.get("agent_id")
                )
                await db.conversations.update_one(
                    {"id": conversation_id},
                    {"$push": {"messages": error_message.dict()}}
                )
                await manager.broadcast({
                    "type": "new_message",
                    "conversation_id": conversation_id,
                    "message": error_message.dict()
                })
    
    # Broadcast new message
    await manager.broadcast({
        "type": "new_message",
        "conversation_id": conversation_id,
        "message": message.dict()
    })
    
    return message

async def call_openclaw_agent(token: str, agent_id: str, message: str, conversation_history: List[Dict] = None) -> Dict[str, Any]:
    """
    Call PicoClaw Agent with user's API key
    Supports Anthropic Claude, OpenAI, and OpenRouter
    """
    try:
        # Parse token to determine provider
        # Format: "provider:api_key" or just "api_key" (defaults to anthropic)
        provider_type = "anthropic"
        api_key = token

        if ":" in token:
            provider_type, api_key = token.split(":", 1)

        # Get agent configuration
        agent = await db.agents.find_one({"id": agent_id})
        if not agent:
            return {
                "content": "[ERROR] Agent not found",
                "usage": {},
                "tool_results": []
            }

        # Determine workspace based on agent type
        workspace = os.path.expanduser(f"~/.picoclaw/workspaces/{agent.get('type', 'default')}")

        # Create PicoClaw agent
        picoclaw_agent = create_default_agent(
            api_key=api_key,
            provider_type=provider_type,
            workspace=workspace,
            brave_api_key=os.getenv("BRAVE_API_KEY")  # Optional web search
        )

        # Convert conversation history to PicoClaw format
        history = []
        if conversation_history:
            for msg in conversation_history:
                if msg["role"] in ["user", "agent", "assistant"]:
                    role = msg["role"]
                    if role == "agent":
                        role = "assistant"
                    history.append(PicoMessage(
                        role=role,
                        content=msg["content"]
                    ))

        # Execute agent
        response = await picoclaw_agent.chat(
            user_message=message,
            history=history,
            agent_context={
                "agent_id": agent_id,
                "agent_name": agent.get("name"),
                "agent_type": agent.get("type")
            }
        )

        return response

    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"PicoClaw Agent error: {error_detail}")
        return {
            "content": f"[ERROR] Failed to contact PicoClaw Agent: {str(e)}",
            "usage": {},
            "tool_results": [],
            "error": str(e)
        }

# Config endpoints
@app.post("/api/config/token")
async def save_openclaw_token(token: str):
    try:
        # Validate token
        if not token or not token.strip():
            raise HTTPException(status_code=400, detail="Token cannot be empty")

        # Check token format
        if ":" in token:
            provider, api_key = token.split(":", 1)
            if provider not in ["anthropic", "openai", "openrouter"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid provider: {provider}. Must be one of: anthropic, openai, openrouter"
                )
            if not api_key or not api_key.strip():
                raise HTTPException(status_code=400, detail="API key cannot be empty")

        # Encrypt token
        encrypted_token = cipher_suite.encrypt(token.encode()).decode()

        existing_config = await db.config.find_one({})
        if existing_config:
            await db.config.update_one(
                {"id": existing_config["id"]},
                {"$set": {"openclaw_token": encrypted_token}}
            )
        else:
            config = UserConfig(openclaw_token=encrypted_token)
            await db.config.insert_one(config.dict())

        return {"success": True, "message": "Token secured"}

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"Error saving token: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Failed to save token: {str(e)}")

@app.get("/api/config")
async def get_config():
    config = await db.config.find_one({})
    if config:
        # Don't expose the encrypted token
        config_data = UserConfig(**config)
        return {
            "has_token": bool(config_data.openclaw_token),
            "settings": config_data.settings
        }
    return {"has_token": False, "settings": {}}

# Metrics endpoint
@app.get("/api/metrics", response_model=Metrics)
async def get_metrics():
    total_conversations = await db.conversations.count_documents({})
    active_agents = await db.agents.count_documents({"status": {"$in": ["connected", "busy"]}})
    
    # Calculate tokens and costs (placeholder logic)
    metrics = Metrics(
        tokens_per_minute=125.0,
        cost_per_hour=0.45,
        active_agents=active_agents,
        total_conversations=total_conversations,
        memory_usage=67.8,
        uptime="04:23:17"
    )
    return metrics

# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming WebSocket messages
            message_data = json.loads(data)
            await manager.broadcast(message_data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)