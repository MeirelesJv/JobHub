# Instalando a Extensão JobHub (Modo Desenvolvimento)

## Pré-requisitos

Antes de carregar a extensão, gere os ícones placeholder:

```bash
cd extension
node scripts/generate-icons.js
```

Isso cria `public/icons/icon16.png`, `icon48.png` e `icon128.png`.

## Carregando no Chrome

1. Abra o Chrome e acesse **chrome://extensions/**
2. Ative o **Modo do desenvolvedor** (toggle no canto superior direito)
3. Clique em **"Carregar sem compactação"**
4. Selecione a pasta **`extension/`** do projeto (não uma subpasta)
5. A extensão aparece na barra do Chrome com o ícone do JobHub

## Inspecionando

- **Service Worker**: chrome://extensions/ → "Inspecionar views: service worker"
- **Popup**: chrome://extensions/ → "Inspecionar views: popup" (ou abrir o popup e F12)
- **Content script**: DevTools na aba do LinkedIn/Gupy → Console

## Atualizando após mudanças

Na página chrome://extensions/, clique no ícone **↻ (reload)** na extensão.

Para mudanças no manifest.json: sempre recarregue a extensão (não apenas a página).

## Variáveis de ambiente

Por padrão a extensão aponta para `http://localhost:8000` (API) e `http://localhost:3000` (webapp).
Para produção, altere `API_BASE` em `src/background/service-worker.js` e `APP_URL` em `src/popup/popup.js`.

## Fluxo de autenticação

1. Usuário faz login no webapp (localhost:3000)
2. O webapp envia o token JWT via `window.postMessage`
3. O content script releva a mensagem para o service worker
4. O service worker salva o token no `chrome.storage.local`
5. Os alarmes de sync (2h / 24h) passam a funcionar

## Estrutura de arquivos

```
extension/
├── manifest.json              # Configuração MV3
├── src/
│   ├── background/
│   │   └── service-worker.js  # Sync, alarmes, notificações
│   ├── popup/
│   │   ├── popup.html         # Interface do popup
│   │   ├── popup.js           # Lógica do popup
│   │   └── popup.css          # Estilos
│   └── content/
│       └── content-script.js  # Relay webapp + detecção LinkedIn/Gupy
└── public/
    └── icons/                 # Gerados por scripts/generate-icons.js
```
