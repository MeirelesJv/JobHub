from app.core.deps import get_db
from app.services.job_service import _get_match_profile, compute_match_score, _titles_match, _normalize

db = next(get_db())
profile = _get_match_profile(db)

desc = """
Descricao da vaga
No BIB Tech, a area de Sustentacao de Sistemas e responsavel por garantir a disponibilidade, estabilidade e evolucao das aplicacoes que suportam as operacoes do Banco Industrial.
Como Analista de Sistemas Junior, voce fara parte de um time.
Requisitos e qualificacoes
Requisitos e Qualificacoes
Graduacao completa ou em andamento em Ciencia da Computacao, Engenharia da Computacao, Sistemas de Informacao ou areas correlatas.
Conhecimentos Tecnicos
Conhecimento em SQL Server, realizando consultas e manipulacao de dados (SELECT, INSERT, UPDATE e DELETE), alem de nocoes de Stored Procedures.
Familiaridade com metodologias ageis, preferencialmente Scrum, e nocoes de ITIL.
Conhecimento basico do Pacote Office, com enfase em Excel.
Diferenciais
Experiencia anterior, incluindo estagio, em sustentacao de sistemas, suporte a aplicacoes ou atendimento de incidentes.
Vivencia em instituicoes financeiras, fintechs ou empresas de tecnologia.
Nocoes de arquitetura de software, APIs, microsservicos e servidores de aplicacao (Tomcat e IIS).
"""

job_data = {
    "title": "Analista de Sistemas Junior",
    "description": desc,
    "level": "junior",
    "job_type": "clt",
    "remote": False,
}

score = compute_match_score(job_data, profile)
print("SCORE:", score)

title_norm = _normalize(job_data["title"])
print("titles_match Analista de Sistemas ->", _titles_match("Analista de Sistemas", title_norm))
print("titles_match Analista de Suporte ->", _titles_match("Analista de Suporte", title_norm))
