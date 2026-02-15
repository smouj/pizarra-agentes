# 🦞 OpenClaw MGS Codec Dashboard

<img width="659" height="563" alt="image" src="https://github.com/user-attachments/assets/6b1467d7-4875-4546-9db5-e72dabc9a0a0" />

### Pizarra de Agentes con Estética Metal Gear Solid

Dashboard de orquestación multi-agente inspirado en la interfaz CODEC de Metal Gear Solid 1 y 2 (1998-2001). Interfaz retro-futurista de espionaje militar con tema CRT phosphor green-black auténtico.

**🆕 NOW WITH PICOCLAW INTEGRATION**: Real AI agents powered by [PicoClaw](https://github.com/sipeed/picoclaw) with executable tools, multi-LLM support, and autonomous reasoning!

![Version](https://img.shields.io/badge/version-1.0.0-green)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## 🎮 Características

### 🦞 PicoClaw Agent Integration (NEW!)
- **Real AI Agents**: Python implementation of PicoClaw with full functionality
- **Multi-LLM Support**: Anthropic Claude, OpenAI GPT-4, OpenRouter
- **Executable Tools**: Shell commands, file operations, web search, memory
- **Agentic Loop**: Autonomous multi-step reasoning with tool execution
- **Sandboxed Security**: Dangerous command blocking, path traversal protection
- **Usage Tracking**: Token counting, cost estimation, tool execution logs

### Interfaz MGS Codec Auténtica
- **Estética CRT Retro**: Scanlines, phosphor glow, curvatura de tubo CRT, estática verde
- **Layout Split-Screen**: Portraits izquierda/derecha estilo codec call original
- **Frequency Display**: Display de frecuencia digital con dígitos rojos parpadeantes
- **Timer PTT**: Reloj digital central con botones MEM/TUNE
- **Ventana de Conversación**: Efecto typewriter línea por línea con beep visual

### Sistema Multi-Agente
- **6 Agentes Especializados**:
  - 🔷 **Orchestrator** - Coordinación y estrategia central
  - ⚡ **Shell Executor** - Operaciones de terminal y comandos del sistema
  - 🔍 **Browser Agent** - Navegación web y extracción de datos
  - 📁 **File Manager** - Operaciones de sistema de archivos
  - 📡 **Communications** - Gestión de comunicaciones multi-canal
  - ⭐ **Custom Skill** - Ejecución de skills personalizadas

### HUD Militar Overlay
- **LIFE Bar**: Uso de tokens/min como barra HP roja decreciente
- **RATIONS Counter**: Costo/hora digital
- **EQUIPMENT Slots**: Uso de modelos LLM (Claude, GPT, Ollama)
- **Agent Health**: Indicadores pulse verde/amarillo/rojo

### Características Avanzadas
- ✅ Conversaciones en tiempo real con WebSocket
- ✅ Gestión segura de tokens OpenClaw (encriptados)
- ✅ Sistema de métricas en vivo
- ✅ Selector de frecuencia de agentes
- ✅ Indicadores de estado (connected, busy, alert, offline)
- ✅ Efectos CRT auténticos (scanlines, glow, glitch)
- ✅ Portraits estilo Yoji Shinkawa
- ✅ Color coding de mensajes (cyan user, green agent, magenta system)

---

## 🚀 Quick Start

### One-Command Installation

```bash
chmod +x install.sh && ./install.sh
```

Then start the dashboard:

```bash
./start.sh
```

Open your browser: **http://localhost:3000**

**📖 Detailed guide**: See [QUICKSTART.md](./QUICKSTART.md)

### Requirements
- Python 3.11+
- Node.js 16+
- MongoDB 4.4+
- npm

# Backend: http://localhost:8001
# Frontend: http://localhost:3000
```

### Configuración del Token OpenClaw

1. Abre la aplicación en tu navegador
2. Haz clic en el botón **🔒 TOKEN** en la barra de control
3. Selecciona tu proveedor de IA (Anthropic, OpenAI, o OpenRouter)
4. Ingresa tu API key (sin prefijos adicionales)
5. El token será encriptado y almacenado de forma segura

### Scripts Disponibles

```bash
./install.sh    # 🔧 Instalación completa del sistema
./start.sh      # 🚀 Iniciar todos los servicios
./stop.sh       # 🛑 Detener todos los servicios
./update.sh     # 🔄 Actualizar desde GitHub automáticamente
./diagnose.sh   # 🩺 Diagnóstico del sistema (troubleshooting)
./logs.sh       # 📋 Ver logs en tiempo real
```

**Nuevo: Auto-Update** 🆕
```bash
./update.sh
```
- ✅ Verifica automáticamente si hay cambios en GitHub
- ✅ Descarga e instala actualizaciones
- ✅ Stash/restore de cambios locales
- ✅ Reinicia servicios si estaban corriendo
- ✅ Muestra resumen de cambios aplicados
- ✅ Detecta cambios en dependencias
- ✅ Retry logic con exponential backoff

**Nuevo: Diagnóstico del Sistema** 🆕
```bash
./diagnose.sh
```
- ✅ Verifica todas las dependencias instaladas
- ✅ Comprueba servicios corriendo (MongoDB, Backend, Frontend)
- ✅ Valida puertos de red (8001, 3000)
- ✅ Test de health del backend y MongoDB
- ✅ Verifica estructura de archivos
- ✅ Chequea configuración de token
- ✅ Sugiere soluciones rápidas para problemas

---

## 🏗️ Arquitectura

### Backend (FastAPI)
```
/app/backend/
├── server.py           # API principal con endpoints
├── requirements.txt    # Dependencias Python
└── .env               # Variables de entorno
```

**Endpoints principales:**
- `GET /api/health` - Health check
- `GET /api/agents` - Lista de agentes
- `POST /api/conversations` - Crear conversación
- `POST /api/conversations/{id}/messages` - Enviar mensaje
- `POST /api/config/token` - Guardar token OpenClaw
- `GET /api/metrics` - Métricas en tiempo real
- `WebSocket /ws` - Comunicación en tiempo real

### Frontend (React)
```
/app/frontend/
├── src/
│   ├── App.js          # Componente principal
│   ├── App.css         # Estilos MGS Codec
│   ├── index.js        # Entry point
│   └── index.css       # Estilos globales
├── public/
│   └── index.html      # HTML base
├── package.json
├── tailwind.config.js  # Configuración Tailwind
└── .env               # Variables de entorno
```

### Base de Datos (MongoDB)
**Colecciones:**
- `agents` - Configuración de agentes
- `conversations` - Historial de conversaciones
- `config` - Configuración de usuario y tokens

---

## 🎨 Diseño MGS Codec

### Paleta de Colores
- **Negro Profundo**: `#001100` - Fondo principal
- **Verde Phosphor**: `#00ff9d` - Color principal neón
- **Cyan**: `#00ffff` - Mensajes de usuario
- **Magenta**: `#ff00ff` - Mensajes del sistema
- **Rojo**: `#ff0033` - Alertas y warnings
- **Amarillo**: `#ffcc00` - Estados busy

### Efectos CRT Auténticos
- **Scanlines**: Líneas horizontales cada 2px
- **Phosphor Glow**: Resplandor verde con blur y sombras
- **CRT Curvature**: Perspectiva sutil de tubo curvado
- **Static Noise**: Estática flotante con fractal noise
- **Vignette**: Oscurecimiento radial en bordes
- **Glitch**: Distorsión en errores

### Typography
- **Monospace**: Courier New para texto
- **VT323**: Google Font para displays digitales
- **Letter-spacing**: Espaciado amplio para efecto terminal

---

## 🔧 Desarrollo

### Comandos Útiles

```bash
# Reiniciar servicios
sudo supervisorctl restart all

# Ver logs
tail -f /var/log/supervisor/backend.*.log
tail -f /var/log/supervisor/frontend.*.log

# Backend manual (desarrollo)
cd /app/backend
python server.py

# Frontend manual (desarrollo)
cd /app/frontend
yarn start

# Verificar API
curl http://localhost:8001/api/health
```

### Variables de Entorno

**Backend (.env)**
```env
MONGO_URL=mongodb://localhost:27017/openclaw_db
BACKEND_PORT=8001
SECRET_KEY=mgs_codec_secret_key_change_in_production_183MHz
```

**Frontend (.env)**
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

---

## 📡 PicoClaw Integration

Esta aplicación integra **PicoClaw**, un asistente de IA ultraligero con capacidades reales de agente autónomo.

**Formato del token**: `provider:api_key`

**Ejemplos**:
- `anthropic:sk-ant-api03-xxxxx` - Anthropic Claude
- `openai:sk-xxxxx` - OpenAI GPT-4
- `openrouter:sk-or-v1-xxxxx` - OpenRouter
- `sk-ant-api03-xxxxx` - Default to Anthropic

**📖 Documentación completa**: Ver [PICOCLAW_INTEGRATION.md](./PICOCLAW_INTEGRATION.md)

---

## 🎯 Funcionalidades Futuras

- [x] ✅ **PicoClaw Integration** - Completed!
- [x] ✅ **Sistema de memoria persistente** - Implemented with memory tool
- [x] ✅ **Real agent capabilities** - Shell, files, web search, etc.
- [x] ✅ **Audio beeps auténticos de MGS** - Completed!
- [ ] Animaciones de incoming call (ring + vibration)
- [ ] Cron jobs scheduler visual
- [ ] ClawHub de skills personalizadas
- [ ] Integraciones de mensajería (WhatsApp, Telegram, Discord)
- [ ] Binary rain particles mejoradas
- [ ] Modo multiplayer para colaboración
- [ ] Grabación de sesiones codec
- [ ] Exportar conversaciones

---

## 🛡️ Seguridad

- ✅ Tokens encriptados con Fernet
- ✅ Variables de entorno para configuración sensible
- ✅ Inputs de contraseña masked
- ✅ CORS configurado correctamente
- ✅ MongoDB con URL configurable
- ✅ No se exponen tokens en logs

---

## 📱 Responsive Design

La interfaz está optimizada para:
- 🖥️ Desktop (1600x900+) - Experiencia completa
- 💻 Laptop (1200-1600px) - Layout adaptado
- 📱 Tablet (768-1200px) - Modo simplificado

---

## 🤝 Contribuciones

Las contribuciones son bienvenidas! Este proyecto es open-source bajo licencia MIT.

---

## 📄 Licencia

MIT License - Ver archivo LICENSE para más detalles

---

## 🎮 Créditos

Inspirado en la icónica interfaz CODEC de **Metal Gear Solid** (1998) y **Metal Gear Solid 2: Sons of Liberty** (2001) de Konami.

Diseño de personajes inspirado en **Yoji Shinkawa**.

Desarrollado con ❤️ para la comunidad de agentes AI.

---

**FREQUENCY 187.89 MHz - CODEC ACTIVE** 🦞

```
╔═══════════════════════════════════════╗
║  OPENCLAW MULTI-AGENT ORCHESTRATION  ║
║         MGS CODEC INTERFACE          ║
╚═══════════════════════════════════════╝
```
