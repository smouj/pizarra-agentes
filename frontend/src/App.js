import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import axios from 'axios';
import Icon from './Icon';
import { locales } from './locales';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function App() {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [language, setLanguage] = useState('en');
  const t = (key) => locales[language][key] || key;
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
  const [selectedProvider, setSelectedProvider] = useState('anthropic');
  const [isConnected, setIsConnected] = useState(false);
  const [openclawConnected, setOpenclawConnected] = useState(false);
  const [openclawUrl, setOpenclawUrl] = useState('http://localhost:8000');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [typingMessage, setTypingMessage] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduledJobs, setScheduledJobs] = useState([]);
  const [codecOpening, setCodecOpening] = useState(true);
  const messagesEndRef = useRef(null);
  const ws = useRef(null);
  const ringAudioRef = useRef(null);

  // Toast notifications
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };

  // Audio refs
  const audioRefs = useRef({
    beep: null,
    callStart: null,
    messageReceived: null,
    alert: null,
    ring: null
  });

  // Initialize audio
  useEffect(() => {
    const tryFormats = async (basePath) => {
      const formats = ['mp3', 'wav', 'ogg'];
      for (const format of formats) {
        try {
          const audio = new Audio(`${basePath}.${format}`);
          await audio.load();
          return audio;
        } catch (e) {
          // Try next format
        }
      }
      return null;
    };

    const loadSounds = async () => {
      audioRefs.current.beep = await tryFormats('/sounds/beep');
      audioRefs.current.callStart = await tryFormats('/sounds/call-start');
      audioRefs.current.messageReceived = await tryFormats('/sounds/message-received');
      audioRefs.current.alert = await tryFormats('/sounds/alert');

      // Load ring sound with loop support
      const ringSound = await tryFormats('/sounds/ring');
      if (ringSound) {
        ringSound.loop = true;
        audioRefs.current.ring = ringSound;
        ringAudioRef.current = ringSound;
      }
    };

    loadSounds();
  }, []);

  // Initialize
  useEffect(() => {
    checkHealth();
    loadAgents();
    loadMetrics();
    checkConfig();

    // Codec opening animation
    const openingTimer = setTimeout(() => {
      setCodecOpening(false);
      playCallStart();
    }, 2500);

    // Update time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Update metrics every 5 seconds
    const metricsInterval = setInterval(() => {
      loadMetrics();
    }, 5000);

    // Setup WebSocket
    setupWebSocket();

    return () => {
      clearTimeout(openingTimer);
      clearInterval(timeInterval);
      clearInterval(metricsInterval);
      if (ws.current) ws.current.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingMessage]);

  // Cleanup incoming call on unmount or when call state changes
  useEffect(() => {
    return () => {
      if (!isIncomingCall) {
        // Stop ring sound
        if (ringAudioRef.current) {
          ringAudioRef.current.pause();
          ringAudioRef.current.currentTime = 0;
        }

        // Stop vibration
        if ('vibrate' in navigator) {
          navigator.vibrate(0);
          if (window.incomingCallVibration) {
            clearInterval(window.incomingCallVibration);
            window.incomingCallVibration = null;
          }
        }
      }
    };
  }, [isIncomingCall]);

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
    if (!openclawToken.trim()) {
      showToast('Please enter an API key', 'warning');
      return;
    }

    try {
      // Format token with provider prefix
      const formattedToken = `${selectedProvider}:${openclawToken}`;

      console.log('Saving token with provider:', selectedProvider);

      const response = await axios.post(`${BACKEND_URL}/api/config/token`, null, {
        params: { token: formattedToken }
      });

      if (response.data.success) {
        setHasToken(true);
        setShowTokenInput(false);
        setOpenclawToken('');
        setSelectedProvider('anthropic');
        playBeep();
        showToast('✓ API token configured successfully!', 'success');
      }
    } catch (error) {
      console.error('Failed to save token:', error);

      let errorMessage = 'Error saving token. ';

      if (error.response) {
        // Server responded with error
        errorMessage += error.response.data.detail || error.response.data.message || 'Server error';
      } else if (error.request) {
        // Request was made but no response
        errorMessage += 'Cannot connect to backend. Make sure the server is running (./start.sh)';
      } else {
        // Something else happened
        errorMessage += error.message;
      }

      showToast(errorMessage, 'error');
    }
  };

  const startConversation = async (agent) => {
    try {
      playCallStart();
      const response = await axios.post(`${BACKEND_URL}/api/conversations`, null, {
        params: {
          agent_id: agent.id,
          title: `🦞 Codec Call - ${agent.name}`
        }
      });
      setConversation(response.data);
      setMessages(response.data.messages || []);
      setSelectedAgent(agent);
    } catch (error) {
      console.error('Failed to start conversation:', error);
      showToast('Failed to initiate codec call. Check connection.', 'error');
    }
  };

  const loadConversation = async (convId, playSound = false) => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/conversations/${convId}`);
      const oldLength = messages.length;
      setConversation(response.data);
      setMessages(response.data.messages || []);

      // Trigger incoming call animation if new agent message arrived
      if (playSound && response.data.messages.length > oldLength) {
        const lastMsg = response.data.messages[response.data.messages.length - 1];
        if (lastMsg.role === 'agent') {
          playMessageReceived();
          // Start incoming call animation
          startIncomingCall();
        }
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !conversation) return;

    if (!hasToken) {
      showToast('No API token found. Sending message via local fallback or waiting for token.', 'warning');
      // We will allow adding a local message and a system warning
      const fakeUserMessage = { role: 'user', content: inputMessage, timestamp: new Date().toISOString() };
      const tokenWarningMessage = { role: 'system', content: 'SYSTEM WARNING: No API token configured. Please click the TOKEN button to set up your AI provider to receive external responses.', timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, fakeUserMessage, tokenWarningMessage]);
      setInputMessage('');
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
        loadConversation(conversation.id, true);
        setTypingMessage(null);
      }, 1000);

    } catch (error) {
      console.error('Failed to send message:', error);
      setTypingMessage(null);
    }
  };

  const playSound = (soundName) => {
    if (!soundEnabled) return;
    const audio = audioRefs.current[soundName];
    if (audio) {
      audio.currentTime = 0;
      audio.volume = 0.5;
      audio.play().catch(e => console.log('Audio play failed:', e));
    }
  };

  const playBeep = () => playSound('beep');
  const playCallStart = () => playSound('callStart');
  const playMessageReceived = () => playSound('messageReceived');
  const playAlert = () => playSound('alert');
  const toggleSound = () => setSoundEnabled(!soundEnabled);

  // Incoming call functions
  const startIncomingCall = () => {
    if (!soundEnabled) return;

    setIsIncomingCall(true);

    // Start ring sound (looping)
    if (ringAudioRef.current) {
      ringAudioRef.current.currentTime = 0;
      ringAudioRef.current.volume = 0.6;
      ringAudioRef.current.play().catch(e => console.log('Ring play failed:', e));
    }

    // Vibration pattern for mobile: [vibrate, pause, vibrate, pause, ...]
    // Pattern: 200ms on, 100ms off, 200ms on, 100ms off, repeat
    if ('vibrate' in navigator) {
      const vibratePattern = [200, 100, 200, 100, 200, 500];

      // Initial vibration
      navigator.vibrate(vibratePattern);

      // Continue vibrating every 1.5 seconds
      const vibrateInterval = setInterval(() => {
        navigator.vibrate(vibratePattern);
      }, 1500);

      // Store interval for cleanup
      window.incomingCallVibration = vibrateInterval;
    }
  };

  const answerCall = () => {
    setIsIncomingCall(false);

    // Stop ring sound
    if (ringAudioRef.current) {
      ringAudioRef.current.pause();
      ringAudioRef.current.currentTime = 0;
    }

    // Stop vibration
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
      if (window.incomingCallVibration) {
        clearInterval(window.incomingCallVibration);
        window.incomingCallVibration = null;
      }
    }

    // Play answer sound
    playBeep();
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

  const renderMessageContent = (content) => {
    if (!content) return null;

    // Split tools
    let blocks = content.split(/(\[Tools used:.*?\])/gs);

    return blocks.map((block, i) => {
      if (block.startsWith('[Tools used:')) {
        return (
          <div key={i} className="tool-execution-canvas">
            <div className="tool-header">
              <Icon name="build" className="icon-sm text-mgs-yellow" />
              <span>SYSTEM COMPILED - TOOL EXECUTION</span>
            </div>
            <div className="tool-body">
              {block.replace('[', '').replace(']', '')}
            </div>
          </div>
        );
      }

      // Parse markdown images ![alt](url)
      let imageBlocks = block.split(/(!\[.*?\]\(.*?\))/gs);
      return imageBlocks.map((subBlock, j) => {
        const imgMatch = subBlock.match(/!\[(.*?)\]\((.*?)\)/);
        if (imgMatch) {
          return (
            <div key={`${i}-${j}`} className="canvas-image-container">
              <img src={imgMatch[2]} alt={imgMatch[1]} className="canvas-image" />
              <div className="canvas-label">INCOMING IMAGE DATALINK: {imgMatch[1].toUpperCase() || 'UNTITLED'}</div>
            </div>
          );
        }

        // Return standard text with br tags
        return (
          <span key={`${i}-${j}`}>
            {subBlock.split('\n').map((line, k) => (
              <React.Fragment key={k}>
                {line}
                {k !== subBlock.split('\n').length - 1 && <br />}
              </React.Fragment>
            ))}
          </span>
        );
      });
    });
  };

  // Scheduler functions
  const loadScheduledJobs = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/jobs`);
      setScheduledJobs(response.data.jobs || []);
    } catch (error) {
      console.error('Failed to load scheduled jobs:', error);
    }
  };

  const deleteScheduledJob = async (jobId) => {
    try {
      await axios.delete(`${BACKEND_URL}/api/jobs/${jobId}`);
      playBeep();
      loadScheduledJobs();
    } catch (error) {
      console.error('Failed to delete job:', error);
      playAlert();
    }
  };

  const toggleScheduledJob = async (jobId, enabled) => {
    try {
      await axios.put(`${BACKEND_URL}/api/jobs/${jobId}/toggle?enabled=${enabled}`);
      playBeep();
      loadScheduledJobs();
    } catch (error) {
      console.error('Failed to toggle job:', error);
      playAlert();
    }
  };

  const openScheduler = () => {
    playBeep();
    loadScheduledJobs();
    setShowScheduler(true);
  };

  // OpenClaw connection
  const connectToOpenclaw = async () => {
    try {
      playBeep();
      const response = await axios.get(`${openclawUrl}/api/agents`);

      // Merge OpenClaw agents with local PicoClaw agents
      const openclawAgents = response.data.map(agent => ({
        ...agent,
        source: 'openclaw',
        id: `openclaw-${agent.id}`
      }));

      setAgents(prev => {
        // Keep only PicoClaw agents and add OpenClaw agents
        const picoAgents = prev.filter(a => !a.source || a.source === 'picoclaw');
        return [...picoAgents, ...openclawAgents];
      });

      setOpenclawConnected(true);
      showToast(`✓ Connected to OpenClaw! Found ${openclawAgents.length} agents`, 'success');
    } catch (error) {
      console.error('Failed to connect to OpenClaw:', error);
      setOpenclawConnected(false);
      showToast(`✗ Failed to connect to OpenClaw at ${openclawUrl}\nMake sure OpenClaw is running.`, 'error');
    }
  };

  return (
    <div className="app-container">
      {/* Toast Notification Container */}
      <div className={`toast-container ${toast.show ? 'show' : ''} ${toast.type}`}>
        <div className="toast-icon">
          <Icon name={toast.type === 'error' ? 'error' : toast.type === 'warning' ? 'warning' : 'info'} className="icon-sm" />
        </div>
        <div className="toast-content">{toast.message}</div>
      </div>

      {/* CRT Screen Container */}
      <div className={`crt-screen ${codecOpening ? 'codec-opening' : ''}`}>
        {/* Codec Opening Animation */}
        {codecOpening && (
          <div className="codec-boot-screen">
            <div className="boot-logo">CODEC</div>
            <div className="boot-text">FREQUENCY 187.89 MHz</div>
            <div className="boot-status">INITIALIZING...</div>
            <div className="boot-progress">
              <div className="boot-progress-bar"></div>
            </div>
          </div>
        )}

        {/* Scanlines Effect */}
        <div className="scanlines"></div>

        {/* Static Noise */}
        <div className="static-noise"></div>

        {/* Vignette */}
        <div className="vignette"></div>

        {/* Main Content */}
        <div className={`codec-container ${codecOpening ? 'hidden' : ''}`}>
          {/* Top Bar - Frequency Display */}
          <div className="top-bar">
            <div className="frequency-display">
              <span className="frequency-label">{t("frequency")}</span>
              <span className="frequency-value">{selectedAgent?.frequency || '187.89'} MHz</span>
            </div>
            <div className="codec-logo">CODEC</div>
            <div className="connection-status">
              <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
              <span className="status-text">{isConnected ? t("online") : t("offline")}</span>
            </div>
          </div>

          {/* Main Codec Interface */}
          <div className="codec-main">
            {/* Left Column - Portrait + HUD Metrics */}
            <div className="left-column">
              <div className={`portrait-container ${isIncomingCall ? 'incoming-call' : ''}`}>
                <div className="portrait-frame">
                  {selectedAgent && (
                    <div className="agent-portrait">
                      <div className="portrait-image">
                        <img
                          src={`/portraits/${selectedAgent.avatar}.png`}
                          alt={selectedAgent.name}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                        <div className="avatar-placeholder" style={{ display: 'none' }}>
                          {selectedAgent.name.charAt(0)}
                        </div>
                      </div>
                      <div className="portrait-info">
                        <div className="portrait-name">{selectedAgent.name}</div>
                        <div className="portrait-type">{selectedAgent.type.toUpperCase()}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Incoming Call Overlay */}
                {isIncomingCall && (
                  <div className="incoming-call-overlay" onClick={answerCall}>
                    <div className="incoming-call-text">
                      <div className="call-label">{t("incoming_call")}</div>
                      <div className="call-action">{t("click_answer")}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* HUD Metrics */}
              <div className="hud-metrics">
                <div className="metric-item">
                  <span className="metric-label">{t("life")}</span>
                  <div className="metric-bar">
                    <div className="bar-fill" style={{ width: `${100 - metrics.tokens_per_minute / 2}%` }}></div>
                  </div>
                  <span className="metric-value">{Math.round(100 - metrics.tokens_per_minute / 2)}%</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">{t("rations")}</span>
                  <span className="metric-value digital">${metrics.cost_per_hour.toFixed(2)}/h</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">{t("agents")}</span>
                  <span className="metric-value digital">{metrics.active_agents}/{agents.length}</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">TOKENS</span>
                  <span className="metric-value digital" title="Used Tokens / Minute limit">{metrics.tokens_per_minute}</span>
                </div>
              </div>
            </div>

            {/* Center - Conversation Window */}
            <div className="conversation-container">
              {/* Timer Bar */}
              <div className="timer-bar">
                <button
                  className="nav-btn"
                  onClick={() => {
                    playBeep();
                    const currentIndex = agents.indexOf(selectedAgent);
                    const prevAgent = agents[(currentIndex - 1 + agents.length) % agents.length];
                    setSelectedAgent(prevAgent);
                  }}
                  title="Previous agent"
                >&lt;</button>
                <div className="timer-display">
                  <span className="timer-label">{t("ptt")}</span>
                  <span className="timer-value">
                    {currentTime.toLocaleTimeString('en-US', { hour12: false })}
                  </span>
                </div>
                <div className="mem-tune">
                  <span
                    className="mem"
                    onClick={() => {
                      playBeep();
                      if (conversation) {
                        navigator.clipboard.writeText(
                          messages.map(m => `[${m.role.toUpperCase()}] ${m.content}`).join('\n\n')
                        );
                        showToast('✓ Conversation copied to memory (clipboard)', 'success');
                      }
                    }}
                    title="Save conversation to memory"
                  >{t("mem")}</span>
                  <span
                    className={`tune ${soundEnabled ? 'text-mgs-green' : 'text-mgs-red'}`}
                    onClick={() => {
                      toggleSound();
                      playBeep();
                    }}
                    title={`Sound: ${soundEnabled ? 'ON' : 'OFF'}`}
                  >{t("tune")}</span>
                </div>
                <button
                  className="nav-btn"
                  onClick={() => {
                    playBeep();
                    const currentIndex = agents.indexOf(selectedAgent);
                    const nextAgent = agents[(currentIndex + 1) % agents.length];
                    setSelectedAgent(nextAgent);
                  }}
                  title="Next agent"
                >&gt;</button>
              </div>

              {/* Messages Window */}
              <div className="messages-window">
                {!conversation ? (
                  <div className="no-conversation">
                    <p className="text-mgs-green">{t("select_agent")}</p>
                    <p className="text-mgs-green mt-4">{t("press_call")}</p>
                  </div>
                ) : (
                  <div className="messages-list">
                    {messages.map((msg, index) => (
                      <div key={msg.id || index} className={`message ${msg.role}`}>
                        <span className="message-timestamp">{formatTime(msg.timestamp)}</span>
                        <span className={`message-content ${getMessageColor(msg.role)}`}>
                          {renderMessageContent(msg.content)}
                        </span>
                      </div>
                    ))}
                    {typingMessage && (
                      <div className="message agent">
                        <span className="message-content text-mgs-green typing-indicator flex items-center gap-2">
                          <Icon name="satellite_alt" className="icon-sm spin" /> {typingMessage}
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
                  placeholder={hasToken ? t("enter_message") : t("config_first")}
                  disabled={!conversation}
                  className="message-input"
                  data-testid="message-input"
                />
                <button
                  onClick={sendMessage}
                  disabled={!conversation || !inputMessage.trim()}
                  className="send-btn"
                  data-testid="send-message-btn"
                >
                  {t("send")}
                </button>
              </div>
            </div>

            {/* Right Column - Portrait + Agent Sidebar */}
            <div className="right-column">
              <div className={`portrait-container ${isIncomingCall ? 'incoming-call' : ''}`}>
                <div className="portrait-frame">
                  <div className="agent-portrait">
                    <div className="portrait-image">
                      <img
                        src="/portraits/operator.png"
                        alt="Operator"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                      <div className="avatar-placeholder" style={{ display: 'none' }}>
                        O
                      </div>
                    </div>
                    <div className="portrait-info">
                      <div className="portrait-name">{t("operator")}</div>
                      <div className="portrait-type">{t("gateway")}</div>
                    </div>
                  </div>
                </div>

                {/* Incoming Call Overlay */}
                {isIncomingCall && (
                  <div className="incoming-call-overlay" onClick={answerCall}>
                    <div className="incoming-call-text">
                      <div className="call-label">{t("incoming_call").replace('◀ ', '')} ▶</div>
                      <div className="call-action">{t("click_answer")}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Agent Sidebar */}
              <div className="agent-sidebar">
                <div className="sidebar-header">{t("freq_select")}</div>
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
                        {t("call")}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Control Bar */}
          <div className="control-bar">
            <button
              className="control-btn"
              onClick={() => {
                playBeep();
                setShowTokenInput(!showTokenInput);
              }}
              data-testid="token-config-btn"
              title="Configure API token"
            >
              <Icon name="lock" className="icon-green icon-sm" /> {t("token")}
            </button>

            <button
              className="control-btn"
              onClick={() => {
                playBeep();
                checkHealth();
                loadAgents();
                loadMetrics();
                if (conversation) {
                  loadConversation(conversation.id);
                }
              }}
              title="Refresh connection and data"
            >
              <Icon name="refresh" className="icon-green icon-sm" /> {t("refresh")}
            </button>
            <button
              className="control-btn"
              onClick={openScheduler}
              title="Manage scheduled operations"
            >
              <Icon name="schedule" className="icon-green icon-sm" /> {t("missions")}
            </button>
            <button
              className="control-btn"
              onClick={() => {
                playBeep();
                if (conversation && messages.length > 0) {
                  if (window.confirm('End current codec call?')) {
                    setConversation(null);
                    setMessages([]);
                  }
                } else {
                  setConversation(null);
                  setMessages([]);
                }
              }}
              data-testid="clear-session-btn"
              title="End codec call"
            >
              {t("exit")}
            </button>
            <button
              className="control-btn"
              onClick={() => {
                playBeep();
                toggleSound();
              }}
              title={`Audio: ${soundEnabled ? 'ON' : 'OFF'}`}
            >
              <Icon name={soundEnabled ? "volume_up" : "volume_off"} className={`icon-sm ${soundEnabled ? 'icon-green' : 'icon-red'}`} /> {t("audio")}
            </button>
            <button
              className="control-btn"
              onClick={() => {
                playBeep();
                setLanguage(language === 'en' ? 'es' : 'en');
              }}
              title="Change Language"
            >
              <Icon name="language" className="icon-green icon-sm" /> {t("language")} ({language.toUpperCase()})
            </button>
            <div className="control-info">
              <span className={isConnected ? 'text-mgs-green' : 'text-mgs-red'}>
                {hasToken ? (
                  <><Icon name="check_circle" className="icon-green icon-sm" /> {t("token_ok")}</>
                ) : (
                  <><Icon name="warning" className="icon-yellow icon-sm" /> {t("no_token")}</>
                )}
              </span>
            </div>
          </div>

          {/* Token Input Modal */}
          {showTokenInput && (
            <div className="modal-overlay" onClick={() => setShowTokenInput(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <span>🔐 {t("secure_token_manager")}</span>
                  <button onClick={() => setShowTokenInput(false)} className="modal-close">
                    <Icon name="close" className="icon-sm" />
                  </button>
                </div>
                <div className="modal-body">
                  <p className="text-mgs-green mb-4 font-bold">{t("select_provider")}</p>

                  {/* Provider Selector */}
                  <div className="provider-selector mb-4">
                    <div className="provider-options">
                      <label className={`provider-option ${selectedProvider === 'anthropic' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="provider"
                          value="anthropic"
                          checked={selectedProvider === 'anthropic'}
                          onChange={(e) => setSelectedProvider(e.target.value)}
                        />
                        <span className="provider-name">Anthropic Claude</span>
                        <span className="provider-desc">Claude 3.5 Sonnet, Opus, Haiku</span>
                      </label>

                      <label className={`provider-option ${selectedProvider === 'openai' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="provider"
                          value="openai"
                          checked={selectedProvider === 'openai'}
                          onChange={(e) => setSelectedProvider(e.target.value)}
                        />
                        <span className="provider-name">OpenAI</span>
                        <span className="provider-desc">GPT-4o, GPT-4 Turbo, o1</span>
                      </label>

                      <label className={`provider-option ${selectedProvider === 'kilocode' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="provider"
                          value="kilocode"
                          checked={selectedProvider === 'kilocode'}
                          onChange={(e) => setSelectedProvider(e.target.value)}
                        />
                        <span className="provider-name">KiloCode</span>
                        <span className="provider-desc">KiloCode Enterprise Models</span>
                      </label>

                      <label className={`provider-option ${selectedProvider === 'google' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="provider"
                          value="google"
                          checked={selectedProvider === 'google'}
                          onChange={(e) => setSelectedProvider(e.target.value)}
                        />
                        <span className="provider-name">Google Gemini</span>
                        <span className="provider-desc">Gemini Pro, Gemini Ultra</span>
                      </label>

                      <label className={`provider-option ${selectedProvider === 'groq' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="provider"
                          value="groq"
                          checked={selectedProvider === 'groq'}
                          onChange={(e) => setSelectedProvider(e.target.value)}
                        />
                        <span className="provider-name">Groq</span>
                        <span className="provider-desc">Ultra-fast inference (Llama, Mixtral)</span>
                      </label>

                      <label className={`provider-option ${selectedProvider === 'together' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="provider"
                          value="together"
                          checked={selectedProvider === 'together'}
                          onChange={(e) => setSelectedProvider(e.target.value)}
                        />
                        <span className="provider-name">Together AI</span>
                        <span className="provider-desc">Open-source models (Llama, Mixtral)</span>
                      </label>

                      <label className={`provider-option ${selectedProvider === 'openrouter' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="provider"
                          value="openrouter"
                          checked={selectedProvider === 'openrouter'}
                          onChange={(e) => setSelectedProvider(e.target.value)}
                        />
                        <span className="provider-name">OpenRouter</span>
                        <span className="provider-desc">Access 200+ models unified</span>
                      </label>

                      <label className={`provider-option ${selectedProvider === 'cohere' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="provider"
                          value="cohere"
                          checked={selectedProvider === 'cohere'}
                          onChange={(e) => setSelectedProvider(e.target.value)}
                        />
                        <span className="provider-name">Cohere</span>
                        <span className="provider-desc">Command R+, RAG optimized</span>
                      </label>
                    </div>
                  </div>

                  <p className="text-mgs-green mb-2 font-bold">ENTER YOUR API KEY:</p>
                  <input
                    type="password"
                    value={openclawToken}
                    onChange={(e) => setOpenclawToken(e.target.value)}
                    placeholder={
                      selectedProvider === 'anthropic' ? 'sk-ant-api03-••••••••••••••••' :
                        selectedProvider === 'openai' ? 'sk-••••••••••••••••' :
                          selectedProvider === 'google' ? 'AIza••••••••••••••••' :
                            selectedProvider === 'groq' ? 'gsk_••••••••••••••••' :
                              selectedProvider === 'together' ? '••••••••••••••••' :
                                selectedProvider === 'cohere' ? '••••••••••••••••' :
                                  selectedProvider === 'kilocode' ? 'klc_••••••••••••••••' :
                                    'sk-or-••••••••••••••••'
                    }
                    className="token-input"
                    data-testid="token-input"
                    onKeyPress={(e) => e.key === 'Enter' && saveToken()}
                  />

                  <div className="text-mgs-cyan text-xs mt-3 mb-2">
                    {selectedProvider === 'anthropic' && (
                      <>
                        <Icon name="info" className="icon-cyan icon-sm" /> Get your key at:{' '}
                        <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-mgs-green">
                          console.anthropic.com
                        </a>
                      </>
                    )}
                    {selectedProvider === 'openai' && (
                      <>
                        <Icon name="info" className="icon-cyan icon-sm" /> Get your key at:{' '}
                        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-mgs-green">
                          platform.openai.com
                        </a>
                      </>
                    )}
                    {selectedProvider === 'google' && (
                      <>
                        <Icon name="info" className="icon-cyan icon-sm" /> Get your key at:{' '}
                        <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-mgs-green">
                          makersuite.google.com
                        </a>
                      </>
                    )}
                    {selectedProvider === 'groq' && (
                      <>
                        <Icon name="info" className="icon-cyan icon-sm" /> Get your key at:{' '}
                        <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-mgs-green">
                          console.groq.com
                        </a>
                      </>
                    )}
                    {selectedProvider === 'together' && (
                      <>
                        <Icon name="info" className="icon-cyan icon-sm" /> Get your key at:{' '}
                        <a href="https://api.together.xyz/settings/api-keys" target="_blank" rel="noopener noreferrer" className="text-mgs-green">
                          api.together.xyz
                        </a>
                      </>
                    )}
                    {selectedProvider === 'openrouter' && (
                      <>
                        <Icon name="info" className="icon-cyan icon-sm" /> Get your key at:{' '}
                        <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-mgs-green">
                          openrouter.ai
                        </a>
                      </>
                    )}
                    {selectedProvider === 'cohere' && (
                      <>
                        <Icon name="info" className="icon-cyan icon-sm" /> Get your key at:{' '}
                        <a href="https://dashboard.cohere.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-mgs-green">
                          dashboard.cohere.com
                        </a>
                      </>
                    )}
                  </div>

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
                    {t("save_token")}
                  </button>
                  <button
                    onClick={() => setShowTokenInput(false)}
                    className="modal-btn cancel"
                  >
                    {t("cancel")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Scheduler Modal */}
          {showScheduler && (
            <div className="modal-overlay" onClick={() => setShowScheduler(false)}>
              <div className="modal-content scheduler-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <span>⏰ {t("scheduled_operations")}</span>
                  <button onClick={() => setShowScheduler(false)} className="modal-close">
                    <Icon name="close" className="icon-sm" />
                  </button>
                </div>
                <div className="modal-body">
                  <div className="scheduler-header">
                    <p className="text-mgs-green font-bold mb-2">
                      <Icon name="schedule" className="icon-green icon-sm" /> {t("mission_scheduler")}
                    </p>
                    <p className="text-mgs-cyan text-xs mb-4">
                      Automate agent tasks, shell commands, and webhooks with cron-like scheduling
                    </p>
                  </div>

                  {/* Job List */}
                  <div className="job-list">
                    {scheduledJobs.length === 0 ? (
                      <div className="no-jobs">
                        <Icon name="event_available" className="icon-green" style={{ fontSize: '3rem' }} />
                        <p className="text-mgs-green mt-2">NO SCHEDULED OPERATIONS</p>
                        <p className="text-mgs-cyan text-xs mt-1">Create a new mission to get started</p>
                      </div>
                    ) : (
                      scheduledJobs.map((job) => (
                        <div key={job._id} className={`job-item ${job.enabled ? 'enabled' : 'disabled'}`}>
                          <div className="job-header">
                            <div className="job-name">
                              <Icon name={job.job_type === 'agent_task' ? 'smart_toy' : job.job_type === 'shell_command' ? 'terminal' : 'webhook'} className="icon-green icon-sm" />
                              <span>{job.name}</span>
                            </div>
                            <div className="job-status">
                              <span className={`status-badge ${job.status}`}>
                                {job.status?.toUpperCase() || 'PENDING'}
                              </span>
                            </div>
                          </div>

                          <div className="job-details">
                            <div className="job-info">
                              <span className="text-mgs-cyan text-xs">{t("type")}</span>
                              <span className="text-mgs-green">{job.job_type?.replace('_', ' ').toUpperCase()}</span>
                            </div>
                            <div className="job-info">
                              <span className="text-mgs-cyan text-xs">{t("schedule")}</span>
                              <span className="text-mgs-green">{job.trigger_type?.toUpperCase()}</span>
                            </div>
                            {job.next_run && (
                              <div className="job-info">
                                <span className="text-mgs-cyan text-xs">{t("next_run")}</span>
                                <span className="text-mgs-yellow">{new Date(job.next_run).toLocaleString()}</span>
                              </div>
                            )}
                            {job.last_run && (
                              <div className="job-info">
                                <span className="text-mgs-cyan text-xs">{t("last_run")}</span>
                                <span className="text-mgs-green">{new Date(job.last_run).toLocaleString()}</span>
                              </div>
                            )}
                          </div>

                          <div className="job-actions">
                            <button
                              className={`job-btn ${job.enabled ? 'pause' : 'play'}`}
                              onClick={() => {
                                playBeep();
                                toggleScheduledJob(job._id, !job.enabled);
                              }}
                              title={job.enabled ? 'Pause' : 'Resume'}
                            >
                              <Icon name={job.enabled ? 'pause' : 'play_arrow'} className="icon-sm" />
                              {job.enabled ? t("pause") : t("resume")}
                            </button>
                            <button
                              className="job-btn delete"
                              onClick={() => {
                                if (window.confirm(`Delete mission: ${job.name}?`)) {
                                  deleteScheduledJob(job._id);
                                }
                              }}
                              title="Delete"
                            >
                              <Icon name="delete" className="icon-sm" />
                              {t("delete")}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Create Job Instructions */}
                  <div className="scheduler-footer">
                    <p className="text-mgs-cyan text-xs mt-4">
                      <Icon name="info" className="icon-cyan icon-sm" /> Use the API or backend to create new scheduled jobs.
                      Documentation: <span className="text-mgs-green">/api/jobs</span>
                    </p>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    onClick={() => {
                      playBeep();
                      loadScheduledJobs();
                    }}
                    className="modal-btn save"
                  >
                    <Icon name="refresh" className="icon-sm" /> {t("refresh")}
                  </button>
                  <button
                    onClick={() => setShowScheduler(false)}
                    className="modal-btn cancel"
                  >
                    {t("close")}
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
