from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import applications, auth, jobs, resume, users
from app.core.config import settings

app = FastAPI(
    title="JobHub API",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"])
app.include_router(applications.router, prefix="/api/applications", tags=["applications"])
app.include_router(resume.router, prefix="/api/resume", tags=["resume"])
app.include_router(users.router, prefix="/api/users", tags=["users"])


@app.get("/health")
def health():
    return {"status": "ok"}
