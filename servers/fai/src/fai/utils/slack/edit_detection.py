import re


def detect_edit_flag(text: str) -> tuple[bool, str]:
    pattern = r"\[([^\]]+)\]"
    matches = re.finditer(pattern, text)

    is_edit_mode = False
    cleaned_text = text

    for match in matches:
        inner_text = match.group(1).strip()
        if inner_text.lower() == "edit":
            is_edit_mode = True
            cleaned_text = cleaned_text.replace(match.group(0), "", 1).strip()
            break

    cleaned_text = " ".join(cleaned_text.split())

    return is_edit_mode, cleaned_text
