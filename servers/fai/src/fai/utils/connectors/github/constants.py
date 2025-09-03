SUPPORTED_LANGUAGES = ["python", "typescript", "go", "ruby", "csharp", "java"]
METHOD_HEADER_PATTERN = r"<summary><code>(.*?)</code></summary>"
METHOD_HEADER_GROUPS_PATTERN = r"(.*?)<a\s*href=(.*?)>(.*?)</a>(\([^\)]*\))"
DESCRIPTION_SECTION_PATTERN = r"#### 📝 Description(.*?)(?=####|$)"
USAGE_SECTION_PATTERN = r"#### 🔌 Usage(.*?)(?=####|$)"
PARAMETERS_SECTION_PATTERN = r"#### ⚙️ Parameters\s*<dl>\s*<dd>(.*?)(?=####|</dd>\s*</dl>\s*$|$)"
