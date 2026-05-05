# JobHub

Plataforma web que agrega vagas de emprego de múltiplas plataformas (LinkedIn, Indeed, Gupy, Catho, InfoJobs) em um único lugar.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14, TailwindCSS, React Query |
| Backend | Python 3.11, FastAPI, PostgreSQL, Redis, Celery |
| Extensão | Chrome Manifest V3 |
| IA | Claude API |
| Infra | Docker (produção), WSL2 (desenvolvimento) |

---

## Pré-requisitos

### 1. Instalar WSL2

Abra o **PowerShell como administrador** e execute:

```powershell
wsl --install
```

Reinicie o computador. Na próxima inicialização, o Ubuntu vai abrir e pedir para criar um usuário e senha. **Guarde essa senha** — ela é usada para comandos com `sudo`.

### 2. Abrir o VS Code no WSL2

Instale a extensão **WSL** no VS Code. Depois, no terminal do Ubuntu:

```bash
code .
```

O VS Code vai abrir conectado ao WSL2 automaticamente.

---

## Setup do ambiente (dentro do WSL2)

Abra o terminal do Ubuntu e execute os passos abaixo.

### 1. Atualizar o sistema

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Instalar Python 3.11

```bash
sudo apt install -y python3.11 python3.11-venv python3.11-dev python3-pip
```

Verificar instalação:

```bash
python3.11 --version
# Python 3.11.x
```

### 3. Instalar Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verificar:

```bash
node --version   # v20.x.x
npm --version    # 10.x.x
```

### 4. Instalar PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
```

Iniciar o serviço:

```bash
sudo service postgresql start
```

Criar banco e usuário:

```bash
sudo -u postgres psql -c "CREATE USER jobhub WITH PASSWORD 'jobhub123';"
sudo -u postgres psql -c "CREATE DATABASE jobhub OWNER jobhub;"
```

Verificar conexão:

```bash
psql -U jobhub -d jobhub -h localhost -c "SELECT version();"
# vai pedir a senha: jobhub123
```

### 5. Instalar Redis

```bash
sudo apt install -y redis-server
sudo service redis-server start
```

Verificar:

```bash
redis-cli ping
# PONG
```

---

## Configurar o projeto

### 1. Clonar o repositório

```bash
git clone https://github.com/seu-usuario/jobhub.git
cd jobhub
```

Ou, se estiver começando do zero:

```bash
mkdir jobhub && cd jobhub
git init
```

### 2. Configurar o backend

```bash
cd backend

# Criar ambiente virtual Python
python3.11 -m venv .venv

# Ativar o ambiente virtual
source .venv/bin/activate

# Instalar dependências
pip install -r requirements.txt
```

Copiar e editar as variáveis de ambiente:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:

```env
# Banco de dados
DATABASE_URL=postgresql://jobhub:jobhub123@localhost/jobhub

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT
SECRET_KEY=troque-por-uma-chave-secreta-longa-e-aleatoria
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Claude API
ANTHROPIC_API_KEY=sk-ant-...

# Indeed API
INDEED_API_KEY=...

# Ambiente
ENVIRONMENT=development
```

Rodar as migrations:

```bash
alembic upgrade head
```

### 3. Configurar o frontend

```bash
cd ../frontend

# Instalar dependências
npm install
```

Copiar e editar as variáveis de ambiente:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Rodar o projeto localmente

Você precisa de **3 terminais** abertos no WSL2.

### Terminal 1 — Backend (FastAPI)

```bash
cd jobhub/backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

API disponível em: `http://localhost:8000`
Documentação automática: `http://localhost:8000/docs`

### Terminal 2 — Worker Celery (scraping e jobs)

```bash
cd jobhub/backend
source .venv/bin/activate
celery -A app.workers.celery worker --loglevel=info
```

### Terminal 3 — Frontend (Next.js)

```bash
cd jobhub/frontend
npm run dev
```

App disponível em: `http://localhost:3000`

---

## Script de atalho

Para não abrir 3 terminais manualmente, crie um script na raiz:

```bash
# Na raiz do projeto
cat > start.sh << 'EOF'
#!/bin/bash
echo "Iniciando JobHub..."

# Garantir que PostgreSQL e Redis estão rodando
sudo service postgresql start
sudo service redis-server start

# Backend
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!

# Celery worker
celery -A app.workers.celery worker --loglevel=info &
CELERY_PID=$!

# Frontend
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "JobHub rodando:"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8000"
echo "  Docs API: http://localhost:8000/docs"
echo ""
echo "Pressione Ctrl+C para parar tudo."

# Aguarda Ctrl+C e mata todos os processos
trap "kill $BACKEND_PID $CELERY_PID $FRONTEND_PID; exit" INT
wait
EOF

chmod +x start.sh
```

Para iniciar tudo:

```bash
./start.sh
```

---

## Estrutura do projeto

```
jobhub/
├── backend/
│   ├── app/
│   │   ├── api/          # Rotas da API (endpoints)
│   │   ├── models/       # Modelos do banco (SQLAlchemy)
│   │   ├── schemas/      # Schemas de validação (Pydantic)
│   │   ├── services/     # Lógica de negócio
│   │   └── workers/      # Jobs Celery (scraping, sync)
│   ├── tests/
│   ├── alembic/          # Migrations do banco
│   ├── .env.example
│   ├── requirements.txt
│   └── main.py
│
├── frontend/
│   ├── src/
│   │   ├── app/          # Páginas (Next.js App Router)
│   │   ├── components/   # Componentes React
│   │   ├── hooks/        # Custom hooks
│   │   └── lib/          # Utilitários, configuração API
│   ├── public/
│   ├── .env.local.example
│   └── package.json
│
├── extension/
│   ├── src/              # Service worker, content scripts
│   ├── public/           # Ícones, manifest.json
│   └── package.json
│
├── start.sh
└── README.md
```

---

## Problemas comuns

**PostgreSQL não inicia**
```bash
sudo service postgresql start
# Se persistir:
sudo pg_ctlcluster 14 main start
```

**Redis não inicia**
```bash
sudo service redis-server start
```

**Erro de permissão no Python**
```bash
# Sempre ative o ambiente virtual antes de rodar o backend
source backend/.venv/bin/activate
```

**Porta já em uso**
```bash
# Ver o que está usando a porta 8000
sudo lsof -i :8000
# Matar o processo
kill -9 <PID>
```

**WSL2 não encontra o VS Code**
```bash
# Instale a extensão WSL no VS Code primeiro, depois:
code .
```

---

## Próximos passos

1. [ ] Modelagem do banco de dados
2. [ ] Fluxo de autenticação (cadastro, login, JWT)
3. [ ] Integração Indeed API
4. [ ] Feed básico de vagas
5. [ ] Kanban de candidaturas
6. [ ] Extensão Chrome v1
