import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import axios from 'axios';
import Icon from './Icon';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function App() {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [metrics, setMetrics] = useState({
    tokens_per_minute: 0,
    cost_per_hour: 0,
    active_agents: 0,
    memory_usage: 0,
    uptime: '00:00:00'
  });
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [openclawToken, setOpenclawToken] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [typingMessage, setTypingMessage] = useState(null);
  const messagesEndRef = useRef(null);
  const ws = useRef(null);

  // Initialize
  useEffect(() => {
    checkHealth();
    loadAgents();
    loadMetrics();
    checkConfig();
    
    // Update time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Setup WebSocket
    setupWebSocket();

    return () => {
      clearInterval(timeInterval);
      if (ws.current) ws.current.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingMessage]);

  const setupWebSocket = () => {
    const wsUrl = BACKEND_URL.replace('http', 'ws') + '/ws';
    ws.current = new WebSocket(wsUrl);
    
    ws.current.onopen = () => {
      console.log('WebSocket connected');
    };
    
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'new_message' && data.conversation_id === conversation?.id) {
        loadConversation(conversation.id);
      }
      if (data.type === 'agent_status') {
        loadAgents();
      }
    };
    
    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  };

  const checkHealth = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/health`);
      setIsConnected(response.data.status === 'operational');
    } catch (error) {
      console.error('Health check failed:', error);
      setIsConnected(false);
    }
  };

  const loadAgents = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/agents`);
      setAgents(response.data);
      if (!selectedAgent && response.data.length > 0) {
        setSelectedAgent(response.data[0]);
      }
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  };

  const loadMetrics = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/metrics`);
      setMetrics(response.data);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  };

  const checkConfig = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/config`);
      setHasToken(response.data.has_token);
    } catch (error) {
      console.error('Failed to check config:', error);
    }
  };

  const saveToken = async () => {
    if (!openclawToken.trim()) return;
    
    try {
      await axios.post(`${BACKEND_URL}/api/config/token`, null, {
        params: { token: openclawToken }
      });
      setHasToken(true);
      setShowTokenInput(false);
      setOpenclawToken('');
      playBeep();
    } catch (error) {
      console.error('Failed to save token:', error);
      alert('Error saving token');
    }
  };

  const startConversation = async (agent) => {
    try {
      const response = await axios.post(`${BACKEND_URL}/api/conversations`, null, {
        params: {
          agent_id: agent.id,
          title: `Codec Call - ${agent.name}`
        }
      });
      setConversation(response.data);
      setMessages(response.data.messages || []);
      setSelectedAgent(agent);
      playBeep();
    } catch (error) {
      console.error('Failed to start conversation:', error);
    }
  };

  const loadConversation = async (convId) => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/conversations/${convId}`);
      setConversation(response.data);
      setMessages(response.data.messages || []);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !conversation) return;
    if (!hasToken) {
      alert('Please configure your OpenClaw token first');
      setShowTokenInput(true);
      return;
    }

    const userMessage = inputMessage.trim();
    setInputMessage('');
    playBeep();

    try {
      // Add user message immediately
      const tempMsg = {
        id: Date.now().toString(),
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, tempMsg]);

      // Show typing indicator
      setTypingMessage('•••');

      // Send to backend
      await axios.post(`${BACKEND_URL}/api/conversations/${conversation.id}/messages`, null, {
        params: {
          role: 'user',
          content: userMessage,
          agent_id: selectedAgent.id
        }
      });

      // Load updated conversation
      setTimeout(() => {
        loadConversation(conversation.id);
        setTypingMessage(null);
      }, 1000);

    } catch (error) {
      console.error('Failed to send message:', error);
      setTypingMessage(null);
    }
  };

  const playBeep = () => {
    // Placeholder for audio beep
    console.log('BEEP');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected': return 'bg-mgs-green';
      case 'busy': return 'bg-mgs-yellow';
      case 'alert': return 'bg-mgs-red animate-pulse';
      default: return 'bg-gray-500';
    }
  };

  const getMessageColor = (role) => {
    switch (role) {
      case 'user': return 'text-mgs-cyan';
      case 'agent': return 'text-mgs-green';
      case 'system': return 'text-mgs-magenta';
      default: return 'text-mgs-green';
    }
  };

  const formatTime = (date) => {
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleString('en', { month: 'short' }).toUpperCase();
    const year = d.getFullYear().toString().slice(-2);
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${day}${month}${year} ${hours}:${minutes}`;
  };

  return (
    <div className="app-container">
      {/* CRT Screen Container */}
      <div className="crt-screen">
        {/* Scanlines Effect */}
        <div className="scanlines"></div>
        
        {/* Static Noise */}
        <div className="static-noise"></div>

        {/* Vignette */}
        <div className="vignette"></div>

        {/* Main Content */}
        <div className="codec-container">
          {/* Top Bar - Frequency Display */}
          <div className="top-bar">
            <div className="frequency-display">
              <span className="frequency-label">FREQUENCY</span>
              <span className="frequency-value">{selectedAgent?.frequency || '187.89'} MHz</span>
            </div>
            <div className="codec-logo">CODEC</div>
            <div className="connection-status">
              <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
              <span className="status-text">{isConnected ? 'ONLINE' : 'OFFLINE'}</span>
            </div>
          </div>

          {/* Main Codec Interface */}
          <div className="codec-main">
            {/* Left Portrait */}
            <div className="portrait-container left-portrait">
              <div className="portrait-frame">
                {selectedAgent && (
                  <div className="agent-portrait">
                    <div className="portrait-image">
                      <div className={`avatar-${selectedAgent.avatar}`}></div>
                    </div>
                    <div className="portrait-info">
                      <div className="portrait-name">{selectedAgent.name}</div>
                      <div className="portrait-type">{selectedAgent.type.toUpperCase()}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Center - Conversation Window */}
            <div className="conversation-container">
              {/* Timer Bar */}
              <div className="timer-bar">
                <button className="nav-btn">&lt;</button>
                <div className="timer-display">
                  <span className="timer-label">PTT</span>
                  <span className="timer-value">
                    {currentTime.toLocaleTimeString('en-US', { hour12: false })}
                  </span>
                </div>
                <div className="mem-tune">
                  <span className="mem">MEM</span>
                  <span className="tune">TUNE</span>
                </div>
                <button className="nav-btn">&gt;</button>
              </div>

              {/* Messages Window */}
              <div className="messages-window">
                {!conversation ? (
                  <div className="no-conversation">
                    <p className="text-mgs-green">SELECT AN AGENT FROM THE FREQUENCY LIST</p>
                    <p className="text-mgs-green mt-4">PRESS [CALL] TO INITIATE CODEC TRANSMISSION</p>
                  </div>
                ) : (
                  <div className="messages-list">
                    {messages.map((msg, index) => (
                      <div key={msg.id || index} className={`message ${msg.role}`}>
                        <span className="message-timestamp">{formatTime(msg.timestamp)}</span>
                        <span className={`message-content ${getMessageColor(msg.role)}`}>
                          {msg.content}
                        </span>
                      </div>
                    ))}
                    {typingMessage && (
                      <div className="message agent">
                        <span className="message-content text-mgs-green typing-indicator">
                          {typingMessage}
                        </span>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="input-area">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder={hasToken ? "ENTER MESSAGE..." : "CONFIGURE TOKEN FIRST"}
                  disabled={!conversation || !hasToken}
                  className="message-input"
                  data-testid="message-input"
                />
                <button
                  onClick={sendMessage}
                  disabled={!conversation || !inputMessage.trim() || !hasToken}
                  className="send-btn"
                  data-testid="send-message-btn"
                >
                  SEND
                </button>
              </div>
            </div>

            {/* Right Portrait - User/Operator */}
            <div className="portrait-container right-portrait">
              <div className="portrait-frame">
                <div className="agent-portrait">
                  <div className="portrait-image">
                    <div className="avatar-operator"></div>
                  </div>
                  <div className="portrait-info">
                    <div className="portrait-name">OPERATOR</div>
                    <div className="portrait-type">GATEWAY</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* HUD Metrics Overlay */}
          <div className="hud-metrics">
            <div className="metric-item">
              <span className="metric-label">LIFE</span>
              <div className="metric-bar">
                <div className="bar-fill" style={{width: `${100 - metrics.tokens_per_minute / 2}%`}}></div>
              </div>
              <span className="metric-value">{Math.round(100 - metrics.tokens_per_minute / 2)}%</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">RATIONS</span>
              <span className="metric-value digital">${metrics.cost_per_hour.toFixed(2)}/h</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">AGENTS</span>
              <span className="metric-value digital">{metrics.active_agents}/{agents.length}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">MEMORY</span>
              <span className="metric-value digital">{metrics.memory_usage.toFixed(1)}%</span>
            </div>
          </div>

          {/* Sidebar - Agent List */}
          <div className="agent-sidebar">
            <div className="sidebar-header">FREQUENCY SELECT</div>
            <div className="agent-list">
              {agents.map(agent => (
                <div
                  key={agent.id}
                  className={`agent-item ${selectedAgent?.id === agent.id ? 'selected' : ''}`}
                  onClick={() => setSelectedAgent(agent)}
                  data-testid={`agent-${agent.type}`}
                >
                  <div className="agent-item-content">
                    <div className={`status-indicator ${getStatusColor(agent.status)}`}></div>
                    <div className="agent-item-info">
                      <div className="agent-item-name">{agent.name}</div>
                      <div className="agent-item-freq">{agent.frequency} MHz</div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startConversation(agent);
                    }}
                    className="call-btn"
                    data-testid={`call-${agent.type}-btn`}
                  >
                    CALL
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Control Bar */}
          <div className="control-bar">
            <button
              className="control-btn"
              onClick={() => setShowTokenInput(!showTokenInput)}
              data-testid="token-config-btn"
            >
              <Icon name="lock" className="icon-green icon-sm" /> TOKEN
            </button>
            <button className="control-btn" onClick={checkHealth}>
              <Icon name="refresh" className="icon-green icon-sm" /> REFRESH
            </button>
            <button
              className="control-btn"
              onClick={() => {
                setConversation(null);
                setMessages([]);
              }}
              data-testid="clear-session-btn"
            >
              EXIT
            </button>
            <div className="control-info">
              <span className="text-mgs-green">
                {hasToken ? (
                  <><Icon name="check_circle" className="icon-green icon-sm" /> TOKEN CONFIGURED</>
                ) : (
                  <><Icon name="warning" className="icon-yellow icon-sm" /> NO TOKEN</>
                )}
              </span>
            </div>
          </div>

          {/* Token Input Modal */}
          {showTokenInput && (
            <div className="modal-overlay" onClick={() => setShowTokenInput(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <span>SECURE TOKEN MANAGER</span>
                  <button onClick={() => setShowTokenInput(false)} className="modal-close">
                    <Icon name="close" className="icon-sm" />
                  </button>
                </div>
                <div className="modal-body">
                  <p className="text-mgs-green mb-4">ENTER YOUR OPENCLAW API TOKEN:</p>
                  <input
                    type="password"
                    value={openclawToken}
                    onChange={(e) => setOpenclawToken(e.target.value)}
                    placeholder="openclaw_••••••••••••••••"
                    className="token-input"
                    data-testid="token-input"
                  />
                  <p className="text-mgs-yellow text-xs mt-2">
                    <Icon name="lock" className="icon-yellow icon-sm" /> Token will be encrypted and stored securely
                  </p>
                </div>
                <div className="modal-footer">
                  <button
                    onClick={saveToken}
                    disabled={!openclawToken.trim()}
                    className="modal-btn save"
                    data-testid="save-token-btn"
                  >
                    SAVE TOKEN
                  </button>
                  <button
                    onClick={() => setShowTokenInput(false)}
                    className="modal-btn cancel"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ASCII Corner Art */}
        <div className="ascii-corner top-left">╔═══</div>
        <div className="ascii-corner top-right">═══╗</div>
        <div className="ascii-corner bottom-left">╚═══</div>
        <div className="ascii-corner bottom-right">═══╝</div>
      </div>
    </div>
  );
}

export default App;
