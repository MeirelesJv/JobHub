import html as html_lib
import re

_ENTITY_MAP = {
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&nbsp;": " ",
    "&#39;": "'", "&apos;": "'", "&quot;": '"',
}

_ENTITY_RE = re.compile("|".join(re.escape(k) for k in _ENTITY_MAP))


def html_to_text(html: str) -> str:
    """Convert job-description HTML to structured plain text."""
    if not html:
        return html

    # Headings → text with surrounding newlines
    html = re.sub(r"<h[1-6][^>]*>", "\n\n", html, flags=re.IGNORECASE)
    html = re.sub(r"</h[1-6]>", "\n", html, flags=re.IGNORECASE)

    # Block elements → newlines
    html = re.sub(r"</?(p|div|section|article|header|footer)[^>]*>", "\n\n", html, flags=re.IGNORECASE)

    # Line breaks
    html = re.sub(r"<br\s*/?>", "\n", html, flags=re.IGNORECASE)

    # List items → bullet points
    html = re.sub(r"<li[^>]*>", "\n• ", html, flags=re.IGNORECASE)
    html = re.sub(r"</li>", "", html, flags=re.IGNORECASE)

    # List containers → newlines
    html = re.sub(r"</?(ul|ol)[^>]*>", "\n", html, flags=re.IGNORECASE)

    # Strong/em → keep text only
    html = re.sub(r"</?(?:strong|b|em|i|span)[^>]*>", "", html, flags=re.IGNORECASE)

    # Strip remaining tags
    text = re.sub(r"<[^>]+>", "", html)

    # Decode HTML entities
    text = _ENTITY_RE.sub(lambda m: _ENTITY_MAP[m.group()], text)

    # Normalise whitespace per line, then collapse excess blank lines
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.split("\n")]
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


_GUPY_SECTION_TITLES = (
    "Responsabilidades e atribuições",
    "Requisitos e qualificações",
    "Informações adicionais",
    "Sobre a empresa",
    "Sobre nós",
    "Benefícios",
    "O que você vai fazer",
    "O que esperamos de você",
    "Requisitos Técnicos",
    "Diferenciais",
)

_GUPY_BENEFIT_TERMS = (
    "Assistência Médica",
    "Assistência Odontológica",
    "Auxílio Creche",
    "Auxilio creche",
    "Convênio Medico",
    "Convênio Médico",
    "Convênio Odontológico",
    "Gympass",
    "Plano de Saúde",
    "Seguro de Vida",
    "Vale Alimentação",
    "Vale Refeição",
    "Vale Transporte",
    "Vale-transporte",
    "Vale-alimentação",
    "Vale-refeição",
)


def format_gupy_description(description: str | None) -> str | None:
    """Format Gupy descriptions into readable plain text sections."""
    if not description:
        return None

    text = html_to_text(description)
    text = html_lib.unescape(text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\u00a0", " ")

    # Gupy often returns section titles glued to the previous/next sentence.
    for title in _GUPY_SECTION_TITLES:
        pattern = re.compile(rf"\s*({re.escape(title)})\s*", re.IGNORECASE)
        text = pattern.sub(lambda m: f"\n\n{m.group(1).strip()}\n", text)

    # Fix common glue after punctuation: "...pessoas.Se" -> "...pessoas. Se"
    text = re.sub(r"([.!?)])(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ])", r"\1 ", text)
    text = re.sub(r"(:)(?=\S)", r"\1 ", text)

    # Turn semicolon-separated requirement/responsibility lists into bullets.
    text = re.sub(r";\s*(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ0-9])", "\n• ", text)
    for term in _GUPY_BENEFIT_TERMS:
        text = re.sub(rf"(?<!• )({re.escape(term)})", rf"\n• \1", text)

    lines: list[str] = []
    previous_blank = False
    section_titles = {title.lower() for title in _GUPY_SECTION_TITLES}
    for raw_line in text.split("\n"):
        line = re.sub(r"[ \t]+", " ", raw_line).strip()
        if not line:
            if lines and not previous_blank:
                lines.append("")
            previous_blank = True
            continue

        if line.lower() in section_titles:
            if lines and lines[-1] != "":
                lines.append("")
            lines.append(line)
            lines.append("")
            previous_blank = True
            continue

        lines.append(line)
        previous_blank = False

    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip() or None
