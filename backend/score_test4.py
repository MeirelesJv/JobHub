from app.core.deps import get_db
from app.services.job_service import _get_match_profile, compute_match_score, _split_requirements, _normalize

db = next(get_db())
profile = _get_match_profile(db)

desc = """
Descricao da vaga
No BIB Tech, a area de Sustentacao de Sistemas e responsavel por garantir a disponibilidade, estabilidade e evolucao das aplicacoes que suportam as operacoes do Banco Industrial. Atuamos em parceria com os times de Desenvolvimento e Infraestrutura para assegurar alta performance e a melhor experiencia para nossos usuarios.
Como Analista de Sistemas Junior, voce fara parte de um time que vai muito alem da resolucao de incidentes. Seu papel sera investigar causas raiz, propor melhorias continuas, otimizar processos e contribuir para a evolucao dos nossos sistemas.
Responsabilidades e atribuicoes
Principais Responsabilidades:
Gestao de Incidentes: Acompanhar e atender chamados de diferentes areas, realizando o diagnostico e a resolucao de incidentes, garantindo o cumprimento dos SLAs estabelecidos.
Analise de Causa Raiz: Investigar a origem dos problemas, indo alem da resolucao imediata, para implementar solucoes definitivas e contribuir para a estabilidade dos sistemas.
Melhoria Continua: Identificar oportunidades de otimizacao, reduzindo tarefas manuais e propondo melhorias que aumentem a eficiencia operacional do time.
Gestao do Conhecimento: Manter a base de conhecimento atualizada, documentando procedimentos, solucoes e boas praticas para facilitar o compartilhamento de informacoes.
Atuacao Colaborativa: Trabalhar em conjunto com as equipes de Desenvolvimento e Infraestrutura na investigacao de incidentes, reporte de bugs e implementacao de melhorias nos sistemas.
Requisitos e qualificacoes
Requisitos e Qualificacoes
Graduacao completa ou em andamento em Ciencia da Computacao, Engenharia da Computacao, Sistemas de Informacao ou areas correlatas.
Conhecimentos Tecnicos
Conhecimento em SQL Server, realizando consultas e manipulacao de dados (SELECT, INSERT, UPDATE e DELETE), alem de nocoes de Stored Procedures.
Conhecimento em logica de programacao e modelagem de dados.
Familiaridade com metodologias ageis, preferencialmente Scrum, e nocoes de ITIL.
Conhecimento basico do Pacote Office, com enfase em Excel.
Diferenciais
Experiencia anterior, incluindo estagio, em sustentacao de sistemas, suporte a aplicacoes ou atendimento de incidentes.
Vivencia em instituicoes financeiras, fintechs ou empresas de tecnologia.
Nocoes de arquitetura de software, APIs, microsservicos e servidores de aplicacao (Tomcat e IIS).
Conhecimento em ferramentas de monitoramento, agendamento de tarefas (Schedulers/Jobs) ou automacao de processos.
"""

job_data = {
    "title": "Analista de Sistemas Junior",
    "description": desc,
    "level": "junior",
    "job_type": "clt",
    "remote": False,
}

text = _normalize(f"{job_data['title']} {job_data['description']}")
required_text, differential_text = _split_requirements(text)

keyword_pool = list(profile.get("skills") or [])
for exp in profile.get("experiences") or []:
    keyword_pool.extend(exp.get("keywords") or [])
keyword_pool.extend(profile.get("education_terms") or [])
keyword_pool.extend(profile.get("extra_keywords") or [])
normalized_pool = [t for term in keyword_pool if len(t := _normalize(term)) >= 2]

matched_required = [t for t in normalized_pool if t in required_text]
matched_diff = [t for t in normalized_pool if t in differential_text]
print("pool size:", len(normalized_pool))
print("matched required (%d, capped 8):" % len(set(matched_required)), sorted(set(matched_required)))
print("matched differential (%d, capped 6):" % len(set(matched_diff)), sorted(set(matched_diff)))
print("SCORE:", compute_match_score(job_data, profile))
