"""Curated list of technical/soft-skill terms used for:
- auto-detecting keywords in a free-text experience description
- skill autocomplete suggestions
- job match scoring (keyword overlap against job title/description)
"""

CURATED_KEYWORDS: list[str] = [
    # Linguagens de programação
    "python", "javascript", "typescript", "java", "c#", "c++", "php", "ruby", "go", "kotlin", "swift", "r",

    # Front-end
    "react", "vue", "angular", "next.js", "html", "css", "sass", "tailwind", "redux",

    # Back-end / frameworks
    "node.js", "django", "flask", "fastapi", "spring", "laravel", "express", ".net",

    # Dados / bancos
    "sql", "postgresql", "mysql", "microsoft sql server", "mongodb", "redis", "elasticsearch",
    "power bi", "tableau", "excel", "etl", "data warehouse", "big data", "spark",

    # Cloud / infra
    "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "linux", "devops",
    "ci/cd", "gitlab ci/cd", "github actions", "jenkins",

    # Ferramentas
    "git", "jira", "postman", "figma", "power point", "word", "sap", "salesforce",

    # Testes
    "jest", "cypress", "selenium", "testes automatizados", "qa",

    # Metodologias / gestão de projetos
    "scrum", "kanban", "agile", "metodologias ágeis", "lean", "pmp", "gestão de projetos",

    # Soft skills / gestão
    "liderança", "gestão de equipe", "gestão de pessoas", "comunicação", "negociação",
    "planejamento estratégico", "atendimento ao cliente", "vendas", "resolução de problemas",
    "trabalho em equipe", "proatividade",

    # Idiomas (também usados como skill quando citados em descrição)
    "inglês", "espanhol",
]
