"""Doxyfile template and rendering."""

from pathlib import Path

DOXYFILE_TEMPLATE = """\
# Project
PROJECT_NAME           = "C++ Library Docs"
STRIP_FROM_PATH        = {repo_path}

# Output format: XML only
GENERATE_XML           = YES
GENERATE_HTML          = NO
GENERATE_LATEX         = NO
GENERATE_MAN           = NO
GENERATE_RTF           = NO
GENERATE_DOCBOOK       = NO
XML_OUTPUT             = xml
OUTPUT_DIRECTORY       = {output_dir}

# XML content
XML_PROGRAMLISTING     = YES
XML_NS_MEMB_FILE_SCOPE = YES

# Input
INPUT                  = {project_path}
RECURSIVE              = YES
FILE_PATTERNS          = *.h *.hpp *.hxx *.h++ *.cu *.cuh *.cpp *.cxx *.c++ *.c *.cc *.ipp
EXTENSION_MAPPING      = cu=C++ cuh=C++

# Extraction
EXTRACT_ALL            = YES
EXTRACT_PRIVATE        = NO
EXTRACT_STATIC         = YES
EXTRACT_LOCAL_CLASSES  = YES
EXTRACT_ANON_NSPACES   = NO
HIDE_UNDOC_MEMBERS     = NO
HIDE_UNDOC_CLASSES     = NO
HIDE_FRIEND_COMPOUNDS  = NO

# Inheritance
INLINE_INHERITED_MEMB  = YES
INHERIT_DOCS           = YES

# C++ features
BUILTIN_STL_SUPPORT    = YES
CPP_CLI_SUPPORT        = NO

# Preprocessing
ENABLE_PREPROCESSING   = YES
MACRO_EXPANSION        = YES
EXPAND_ONLY_PREDEF     = NO
SKIP_FUNCTION_MACROS   = YES

# Documentation style
JAVADOC_AUTOBRIEF      = YES
QT_AUTOBRIEF           = NO
MULTILINE_CPP_IS_BRIEF = NO
JAVADOC_BANNER         = NO
AUTOLINK_SUPPORT       = YES
MARKDOWN_SUPPORT       = YES

# Exclusions
EXCLUDE_PATTERNS       = */detail/* */test/* */tests/* */testing/* */examples/* */__detail/* */.git/*
EXCLUDE_SYMBOLS        = detail::* __detail::*

# Performance
NUM_PROC_THREADS       = 0
QUIET                  = YES
WARNINGS               = NO
WARN_IF_UNDOCUMENTED   = NO
WARN_IF_DOC_ERROR      = NO
WARN_NO_PARAMDOC       = NO

# Reduce output bloat
REFERENCED_BY_RELATION = NO
REFERENCES_RELATION    = NO
VERBATIM_HEADERS       = NO
SOURCE_BROWSER         = NO
INLINE_SOURCES         = NO
STRIP_CODE_COMMENTS    = YES
SORT_MEMBER_DOCS       = YES
SORT_BRIEF_DOCS        = NO
SORT_MEMBERS_CTORS_1ST = YES

# Graphs (disabled)
HAVE_DOT               = NO
CLASS_DIAGRAMS         = NO
COLLABORATION_GRAPH    = NO
INCLUDE_GRAPH          = NO
INCLUDED_BY_GRAPH      = NO
CALL_GRAPH             = NO
CALLER_GRAPH           = NO
GRAPHICAL_HIERARCHY    = NO
DIRECTORY_GRAPH        = NO
"""


def render_doxyfile(project_path: Path, repo_path: Path, output_dir: Path) -> str:
    """Return the rendered Doxyfile content for the given paths."""
    return DOXYFILE_TEMPLATE.format(
        repo_path=repo_path,
        output_dir=output_dir,
        project_path=project_path,
    )
