# JobHub

Plataforma web local para agregar vagas de emprego de múltiplas fontes (LinkedIn, Gupy, Vagas.com.br, Catho, InfoJobs), com feed unificado, kanban de candidaturas e busca automática em segundo plano.

Feito pra uso pessoal, single-user, 100% via Docker — sem cadastro, sem login, sem configuração de chaves.

---

## Stack

| Camada          | Tecnologia                                |
| --------------- | ----------------------------------------- |
| Frontend        | Next.js 14, TailwindCSS, React Query      |
| Backend         | Python 3.12, FastAPI, PostgreSQL, Redis   |
| Coleta de vagas | Celery (worker + beat), Playwright, httpx |
| Infra           | Docker Compose                            |

---

## Pré-requisitos

Só o **Docker Desktop**:

- Download: https://www.docker.com/products/docker-desktop/
- Durante a instalação, manter "Use WSL 2 based engine" marcado (padrão)
- Depois de instalar, abrir o Docker Desktop e esperar o ícone da bandeja ficar verde

Nada de `.env`, chave de API ou variável pra configurar — tudo já vem fixo no `docker-compose.yml`.

---

## Instalação e uso — passo a passo

### 1. Clonar o repositório

```powershell
git clone https://github.com/MeirelesJv/JobHub.git
cd jobhub
```

### 2. Abrir o JobHub

Dê duplo clique em **`JobHub.exe`**, na raiz do projeto. É um executável standalone — não precisa ter Python nem nada além do Docker instalado.

Isso abre uma janelinha com um botão **Iniciar sistema**. Clique nele:

- Primeira vez: constrói as imagens Docker (uns 5–10 min — baixa dependências, o Playwright baixa o Chromium)
- Próximas vezes: sobe os containers já prontos (segundos)

O status muda de "Iniciando…" pra **"Online — http://localhost:3000"** em verde quando terminar, e o navegador abre sozinho. O log de cada etapa aparece na caixa de texto da janela.

Por trás dos panos isso sobe 6 containers: banco (`db`), fila (`redis`), API (`backend`), worker de coleta (`celery`), agendador (`celery-beat`) e o site (`frontend`) — via `docker compose`. O backend já roda as migrations do banco sozinho ao iniciar.

**Minimizar** manda a janela pra bandeja do Windows (ícones ocultos, perto do relógio) — o JobHub continua rodando em segundo plano. Clique com o botão direito no ícone da bandeja pra reabrir a janela, parar o sistema ou sair.

**Fechar no X para tudo de verdade** — roda `docker compose down` antes de encerrar, garantindo que nenhum container fica pra trás rodando escondido.

Prefere sem GUI? Dá pra rodar direto pelo terminal também — veja [Comandos úteis](#comandos-úteis).

### 3. Abrir o site

http://localhost:3000

Primeiro acesso cai direto na tela de configuração inicial (onboarding) — só 1 passo: cargo desejado, nível, cidade e se aceita remoto. Ao concluir, já dispara a primeira busca de vagas e te leva pro dashboard.

### 4. Usar o feed de vagas

Na aba **Vagas**:

- Filtre por cargo, plataforma, nível, regime e modalidade
- **Atualizar vagas** dispara uma busca manual nos sites habilitados
- Cada card mostra o % de compatibilidade (match) com seu perfil
- **Ver vaga no site** abre a vaga original; **Marcar como candidatado** registra no kanban

### 5. Acompanhar candidaturas

Na aba **Candidaturas** — kanban com as vagas que você marcou como candidatado. Atualização de status é manual (arrastar entre colunas).

### 6. Completar o currículo

Na aba **Currículo**, preencha experiências, formação, habilidades e idiomas — isso melhora o cálculo de match. A aba **Preferências de busca** dentro do Currículo é onde ficam **cargos desejados** (pode cadastrar mais de um) e **localização**.

### 7. Ajustar a busca automática

Na aba **Configurações → Vagas**, dá pra configurar:

| Opção                              | O que faz                                                                                                                                                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sites para pesquisa manual**     | Quais sites entram quando você clica em "Atualizar vagas"                                                                                                                                                 |
| **Sites para busca automática**    | Quais sites o JobHub varre sozinho em segundo plano (lista independente da manual)                                                                                                                        |
| **Frequência da busca automática** | 10 min / 30 min / 1h / 2h                                                                                                                                                                                 |
| **Limite de busca**                | 7 / 15 / 30 dias — até quando no passado ele procura vagas. Vagas somem do feed automaticamente 1 dia depois de saírem desse limite (a menos que você já tenha se candidatado — essas nunca são apagadas) |
| **Empresas bloqueadas**            | Empresas que nunca devem aparecer no feed                                                                                                                                                                 |

A busca automática roda sozinha no `celery-beat` mesmo com o navegador fechado, desde que os containers estejam de pé (ou seja: mesmo com a janela do JobHub minimizada na bandeja).

### 8. Parar / religar

Fechando no X, ou clicando em **Parar sistema** (na janela ou pelo menu da bandeja), o `docker compose down` já roda sozinho. Pra religar depois, dê duplo clique em `JobHub.exe` de novo.

Isso mantém os dados salvos. Pra resetar tudo (apagar o banco), use o terminal — veja abaixo.

---

## Como funciona a coleta de vagas

Cada plataforma tem um collector próprio em `backend/app/services/collectors/`, rodando dentro do worker Celery — sem depender de extensão de navegador nem sessão aberta:

| Plataforma   | Estratégia                                 |
| ------------ | ------------------------------------------ |
| LinkedIn     | scraping via API pública de busca          |
| Gupy         | Playwright headless (portal + API interna) |
| Vagas.com.br | HTML público via httpx                     |
| Catho        | httpx com impersonation anti-bot           |
| InfoJobs     | HTML público via httpx                     |

Todos usam o mesmo mecanismo de corte: param de paginar assim que encontram uma vaga já vista antes (`get_platform_sync_anchor` / `compute_sync_cutoff` em `job_service.py`), então uma nova rodada de sync é rápida.

Candidatura continua manual — não existe auto-apply implementado.

---

## Estrutura do projeto

```
jobhub/
├── JobHub.exe            # painel — duplo clique, botão iniciar/parar e ícone de bandeja
├── jobhub_app.py         # código-fonte do painel (Python + customtkinter + pystray)
├── JobHub.spec           # config do PyInstaller pra rebuildar o .exe
├── backend/
│   ├── app/
│   │   ├── api/          # Rotas da API (jobs, applications, resume, users)
│   │   ├── core/          # Config e dependências (usuário único local)
│   │   ├── models/        # Modelos do banco (SQLAlchemy)
│   │   ├── schemas/       # Schemas de validação (Pydantic)
│   │   ├── services/
│   │   │   └── collectors/  # Um scraper por plataforma
│   │   └── workers/       # Tasks Celery (sync, cleanup, agendamento)
│   ├── alembic/           # Migrations do banco
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   └── (app)/     # dashboard, jobs, applications, resume, settings, onboarding
│   │   ├── components/    # Componentes React
│   │   ├── hooks/         # Custom hooks (React Query)
│   │   ├── store/         # Estado global (Zustand)
│   │   └── lib/           # Utilitários, cliente API
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml
└── README.md
```

---

## Quando usar `--build`

| Situação                                     | Precisa `--build`?                     |
| -------------------------------------------- | -------------------------------------- |
| Editar código Python/JS                      | Não — hot reload automático via volume |
| Alterar `requirements.txt`                   | Sim                                    |
| Alterar `package.json`                       | Sim                                    |
| Alterar `Dockerfile` ou `docker-compose.yml` | Sim                                    |

---

## Comandos úteis

Alternativa ao painel, direto no terminal (PowerShell, na raiz do projeto):

```powershell
# Subir tudo (equivalente ao botão "Iniciar sistema")
docker compose up -d --build   # primeira vez / mudou dependência
docker compose up -d           # próximas vezes

# Parar tudo, mantendo os dados (equivalente ao "Parar sistema")
docker compose down

# Parar e apagar o banco (reset total)
docker compose down -v

# Ver logs de um serviço específico
docker compose logs -f backend
docker compose logs -f celery
docker compose logs -f celery-beat
docker compose logs -f frontend

# Rodar migrations manualmente (normalmente automático no start do backend)
docker compose exec backend alembic upgrade head

# Disparar uma sync manual de uma plataforma específica direto pelo worker
docker compose exec celery celery -A app.workers.celery call app.workers.tasks.sync_linkedin_jobs

# Reiniciar só um serviço depois de mudar algo que não hot-reloada
docker compose restart backend
```

### Rebuildar o `JobHub.exe`

Só necessário se você mexer em `jobhub_app.py`. Precisa de Python 3.12+ instalado:

```powershell
python -m venv .app-venv
.\.app-venv\Scripts\pip install customtkinter pystray pillow pyinstaller
.\.app-venv\Scripts\python -m PyInstaller --noconfirm --onefile --windowed --name "JobHub" jobhub_app.py
```

O executável novo aparece em `dist\JobHub.exe` — mova pra raiz do projeto substituindo o antigo.

---

## Problemas comuns

**Docker não inicia / ícone vermelho**

- Abrir Docker Desktop e esperar ficar verde antes de clicar em "Iniciar sistema" (ou rodar `docker compose up`)

**"Docker Desktop não está rodando" no painel mesmo com o Docker aberto**

- Espera o ícone da bandeja do Docker Desktop ficar verde (não só abrir a janela) e clica em "Iniciar sistema" de novo

**Porta já em uso**

```powershell
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

**Backend não conecta ao banco**

- O healthcheck do PostgreSQL garante a ordem de inicialização. Se falhar:

```powershell
docker compose down -v
docker compose up --build
```

**Mudei o código mas não refletiu**

- Frontend e backend têm hot reload via volume mount. Se não refletir, reinicie o container:

```powershell
docker compose restart backend
docker compose restart frontend
```

**Log do worker não para de imprimir SQL**

- É o log de query do SQLAlchemy — só aparece com `DEBUG=true`. No setup atual o padrão já é `DEBUG=false`; se algum dia precisar debugar SQL, defina `DEBUG: "true"` em `environment:` do serviço `backend`/`celery` no `docker-compose.yml`.

**Busca automática não roda**

- Confirme que o container `celery-beat` está de pé: `docker compose ps`. É ele (não o `celery` sozinho) quem dispara a sync periódica.

**Diferença entre minimizar, fechar no X e "Sair" da bandeja**

- **Minimizar**: vai pra bandeja, tudo continua rodando (esse é o uso normal do dia a dia)
- **X**: para os containers (`docker compose down`) e fecha o painel — desliga tudo de verdade
- **Sair** (menu da bandeja): fecha só o painel, sem mexer nos containers — use se quiser deixar o JobHub rodando em segundo plano sem o ícone de bandeja visível

**Antivírus/SmartScreen reclama do `JobHub.exe`**

- Comum em executáveis gerados com PyInstaller sem assinatura digital, é falso positivo. Pode conferir o código-fonte em `jobhub_app.py` ou rebuildar localmente (veja acima).

---

## Roadmap

MVP funcional cobre: coleta multi-plataforma, feed com match score, kanban manual de candidaturas, busca automática configurável em segundo plano.

Não implementado ainda (ver `CLAUDE.md` pra escopo completo):

- Candidatura automática (Turbo/Assisted mode)
- Matching por IA (Claude API) para ranquear o feed
- Sync automático de status de candidatura nas plataformas
- Draft de respostas para perguntas abertas de formulário
