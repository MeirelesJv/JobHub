#!/bin/bash

# Encerra processos anteriores nas mesmas portas/nomes
echo "Encerrando processos anteriores..."
fuser -k 8000/tcp 3000/tcp 2>/dev/null
pkill -f "uvicorn app.main:app"  2>/dev/null
pkill -f "celery -A app.workers" 2>/dev/null
pkill -f "next dev"              2>/dev/null
sleep 1

echo "Iniciando JobHub..."

# Garantir que PostgreSQL e Redis estão rodando
sudo service postgresql start
sudo service redis-server start

# Backend
cd backend
source .venv/bin/activate

echo "Aplicando migrations do banco..."
alembic upgrade head || exit 1

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
