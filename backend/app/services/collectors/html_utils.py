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
