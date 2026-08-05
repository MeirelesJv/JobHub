# JobHub

Plataforma web que agrega vagas de emprego de múltiplas plataformas (LinkedIn, Indeed, Gupy, Catho, InfoJobs) em um único lugar.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14, TailwindCSS, React Query |
| Backend | Python 3.12, FastAPI, PostgreSQL, Redis, Celery |
| Extensão | Chrome Manifest V3 |
| IA | Claude API |
| Infra | Docker Desktop |

---

## Pré-requisitos

Instale o **Docker Desktop**:
- Download: https://www.docker.com/products/docker-desktop/
- Durante a instalação, manter "Use WSL 2 based engine" marcado (padrão)
- Após instalar, abrir o Docker Desktop e aguardar o ícone na bandeja ficar verde

---

## Configurar o projeto

### 1. Clonar o repositório

```powershell
git clone https://github.com/seu-usuario/jobhub.git
cd jobhub
```

### 2. Configurar variáveis de ambiente do backend

```powershell
copy backend\.env.example backend\.env
```

Edite `backend/.env` com suas chaves:

```env
# Banco de dados — não altere, o Docker já configura
DATABASE_URL=postgresql://jobhub:jobhub123@db/jobhub

# Redis — não altere, o Docker já configura
REDIS_URL=redis://redis:6379/0

# JWT — troque por uma chave longa e aleatória
SECRET_KEY=troque-por-uma-chave-secreta-longa-e-aleatoria
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Claude API
ANTHROPIC_API_KEY=sk-ant-...

# Indeed API
INDEED_PUBLISHER_ID=

# Ambiente
ENVIRONMENT=development
DEBUG=true

# CORS
ALLOWED_ORIGINS=["http://localhost:3000"]
```

### 3. Configurar variáveis de ambiente do frontend

```powershell
copy frontend\.env.local.example frontend\.env.local
```

O arquivo já vem configurado corretamente para desenvolvimento local.

---

## Rodar o projeto

### Primeira vez (build das imagens)

```powershell
docker-compose up --build
```

Demora ~5–10 min na primeira vez — baixa imagens e instala dependências.

### Próximas vezes

```powershell
docker-compose up
```

### Quando estiver pronto

```
frontend  | ▲ Next.js 14.2.3
frontend  | - Local: http://localhost:3000
backend   | INFO: Application startup complete.
```

| Serviço | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:8000 |
| Docs API | http://localhost:8000/docs |

### Parar tudo

```powershell
docker-compose down
```

### Parar e apagar banco (reset total)

```powershell
docker-compose down -v
```

---

## Rodar migrations manualmente

As migrations rodam automaticamente ao subir o backend. Se precisar rodar manualmente:

```powershell
docker-compose exec backend alembic upgrade head
```

---

## Quando usar `--build`

Só necessário quando mudar dependências:

| Situação | Precisa `--build`? |
|---|---|
| Editar código Python/JS | Não — hot reload automático |
| Alterar `requirements.txt` | Sim |
| Alterar `package.json` | Sim |
| Alterar `Dockerfile` | Sim |

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
│   ├── alembic/          # Migrations do banco
│   ├── Dockerfile
│   ├── .env.example
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── app/          # Páginas (Next.js App Router)
│   │   ├── components/   # Componentes React
│   │   ├── hooks/        # Custom hooks
│   │   └── lib/          # Utilitários, configuração API
│   ├── Dockerfile
│   ├── .env.local.example
│   └── package.json
│
├── extension/
│   ├── src/              # Service worker, content scripts
│   ├── public/           # Ícones, manifest.json
│   └── package.json
│
├── docker-compose.yml
└── README.md
```

---

## Problemas comuns

**Docker não inicia / ícone vermelho**
- Abrir Docker Desktop e aguardar ficar verde antes de rodar `docker-compose up`

**Porta já em uso**
```powershell
# Ver o que está usando a porta 8000
netstat -ano | findstr :8000
# Matar pelo PID
taskkill /PID <PID> /F
```

**Backend não conecta ao banco**
- O healthcheck do PostgreSQL garante a ordem de inicialização. Se falhar, rode:
```powershell
docker-compose down -v
docker-compose up --build
```

**Mudei o código mas não refletiu**
- Frontend e backend têm hot reload automático via volume mount
- Se ainda não refletiu, reinicie o container específico:
```powershell
docker-compose restart backend
docker-compose restart frontend
```

**Ver logs de um serviço específico**
```powershell
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f celery
```

---

## Próximos passos

1. [ ] Modelagem do banco de dados
2. [ ] Fluxo de autenticação (cadastro, login, JWT)
3. [ ] Integração Indeed API
4. [ ] Feed básico de vagas
5. [ ] Kanban de candidaturas
6. [ ] Extensão Chrome v1
