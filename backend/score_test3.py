from app.core.deps import get_db
from app.services.job_service import _get_match_profile, compute_match_score

db = next(get_db())
profile = _get_match_profile(db)
print("extra_keywords in profile:", profile.get("extra_keywords"))

job_data = {
    "title": "DBA Junior",
    "description": "Requisitos: a pessoa ira fazer otimizacao de banco de dados e suporte a ambiente AWS.",
    "level": "junior",
    "job_type": "clt",
    "remote": False,
}
print("SCORE:", compute_match_score(job_data, profile))
