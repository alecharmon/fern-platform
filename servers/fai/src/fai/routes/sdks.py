from __future__ import annotations

from fastapi import (
    Body,
    Depends,
    HTTPException,
)
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from fai.app import fai_app
from fai.dependencies import verify_org_token
from fai.models.api.sdks_api import (
    AnalyzeCommitDiffRequest,
    AnalyzeCommitDiffResponse,
    ConsolidateChangelogRequest,
    ConsolidateChangelogResponse,
    VersionBump,
)
from fai.settings import LOGGER
from fai.utils.diff_chunking import (
    MAX_AI_DIFF_BYTES,
    MAX_CHUNKS,
    MAX_RAW_DIFF_BYTES,
    chunk_diff,
    max_version_bump,
)
from fai.utils.generate_model import generate_anthropic_generic_async

LANGUAGE_RULES: dict[str, str] = {
    "typescript": """Language-specific breaking change rules for TypeScript:

MAJOR (breaking):
- Removing a required response field is always MAJOR
- Removing or renaming a public class, method, function, or exported symbol is MAJOR
- Making a response field optional is MAJOR (type changes from T to T | undefined,
  breaking existing property access without null checks)
- Changing a method return type (e.g. Promise<T> to Promise<T | undefined>, or T to T | null) is MAJOR
- New enum values are MAJOR if the SDK generates exhaustive switch/if-else chains
  (callers get compile errors on unhandled cases)
- Changing a union type (adding/removing variants) is MAJOR if callers use
  exhaustive type narrowing or discriminated unions
- Adding a new required property to a request/input type is MAJOR (existing callers won't compile)
- Removing or renaming an exported type, interface, or type alias is MAJOR
- Changing the type of an existing property (e.g. string to number, or string to string[]) is MAJOR
- Changing a generic type parameter constraint (e.g. <T extends Foo> to <T extends Bar>) is MAJOR
- Converting a synchronous method to async (or vice versa) is MAJOR (changes return type to Promise<T>)
- Removing a default export or switching between default and named exports is MAJOR
- Changing the structure of a discriminated union (e.g. changing the discriminant field name) is MAJOR
- Removing or renaming environment/server URL constants is MAJOR
- Changing the constructor signature of a client class (adding required params) is MAJOR
- Narrowing a parameter type (e.g. string | number to string) is MAJOR (callers passing number break)

MINOR (backward-compatible additions):
- Adding a new optional parameter to a function is MINOR
- Adding new exported types, interfaces, or classes is MINOR
- Adding new methods to an existing client class is MINOR
- Adding new optional properties to request types is MINOR
- Adding new enum values when NOT used in exhaustive checks is MINOR
- Adding new environment/server URL constants is MINOR
- Widening a parameter type (e.g. string to string | number) is MINOR
- Adding new re-exports from index files is MINOR
- Adding new error types or exception classes is MINOR
- Adding new RequestOptions fields (e.g. timeout, retries) is MINOR
- Deprecating (but not removing) a public API is MINOR

PATCH (no API surface change):
- Changes to internal/private modules (core/, _internal/, utils/) are PATCH
- Reordering imports, formatting, or comment changes are PATCH
- Updating SDK version headers (X-Fern-SDK-Version, User-Agent) is PATCH
- Refactoring HTTP client internals without changing observable defaults or behavior is PATCH
- Updating dependency versions in package.json is PATCH
- Adding or modifying JSDoc/TSDoc comments is PATCH
- Refactoring internal implementation without changing public signatures is PATCH
- Changes to .npmignore, tsconfig.json, or build configuration are PATCH
- Updating serialization/deserialization logic that preserves the same public types is PATCH""",
    "python": """Language-specific breaking change rules for Python:

MAJOR (breaking):
- Removing a required response field is always MAJOR
- Removing or renaming a public class, method, or function is always MAJOR
- Adding a new required parameter to a public method is MAJOR (callers get TypeError)
- Renaming a parameter in a public method is MAJOR if callers use keyword arguments
- Removing a parameter from a public method signature is MAJOR
- Changing the type of a parameter from one concrete type to an incompatible one is MAJOR
- Changing exception types raised by a method (callers catching specific exceptions break) is MAJOR
- Removing or renaming a public module or subpackage is MAJOR (import statements break)
- Moving a public class/function to a different module without re-exporting from the original is MAJOR
- Changing a class from inheriting one base to another when callers use isinstance() checks is MAJOR
- Removing a public class attribute or property is MAJOR

MINOR (backward-compatible additions):
- Making a response field optional is usually MINOR (Python uses None propagation; callers rarely type-check strictly)
- New enum values are MINOR (unknown values are handled gracefully with string fallbacks)
- Changing a return type from a concrete type to Optional is MINOR (duck typing absorbs this)
- Adding new public methods, classes, or modules is MINOR
- Adding new optional parameters (with defaults) is MINOR
- Adding new optional fields to Pydantic models is MINOR
- Adding new exception/error classes is MINOR
- Adding new class attributes or properties is MINOR
- Adding new type overloads (@overload decorator) is MINOR
- Adding new environment/server URL constants is MINOR
- Adding new RequestOptions fields (e.g. timeout, max_retries) is MINOR
- Deprecating (but not removing) a public API is MINOR
- Widening a type annotation (e.g. str to Union[str, int]) is MINOR

PATCH (no API surface change):
- Changes to private methods (prefixed with _) are PATCH
- Changes to type hints only (no runtime effect) are PATCH
- Reformatting, docstring updates, or comment changes are PATCH
- Updating SDK version headers (X-Fern-SDK-Version, User-Agent) are PATCH
- Refactoring httpx/requests client internals without changing observable defaults or behavior is PATCH
- Updating dependency versions in pyproject.toml/setup.py is PATCH
- Updating serialization/deserialization logic that preserves the same public types is PATCH
- Refactoring internal implementation without changing public signatures is PATCH
- Changes to __init__.py that don't alter public re-exports are PATCH
- Changes to conftest.py, test files, or CI configuration are PATCH""",
    "java": """Language-specific breaking change rules for Java:

MAJOR (breaking):
- Removing a required response field is always MAJOR
- Removing or renaming a public class, method, or interface is always MAJOR
- Making a response field optional (e.g. T to Optional<T>) is MAJOR (callers must handle Optional unwrapping)
- New enum values are MAJOR if the SDK generates exhaustive switch statements
- Adding a new required parameter to a public method is MAJOR
- Changing a method's return type is MAJOR (even if compatible at runtime, recompilation fails)
- Removing or changing a public static final constant is MAJOR
- Changing a class from concrete to abstract (or vice versa) is MAJOR
- Changing the checked exceptions declared in a throws clause is MAJOR
- Removing a public constructor or changing its parameter list is MAJOR
- Removing an interface that a public class implements is MAJOR
- Changing generic type parameters on a public class (e.g. Foo<T> to Foo<T, U>) is MAJOR
- Moving a public class to a different package without re-exporting is MAJOR
- Narrowing a parameter type (e.g. Object to String) is MAJOR
- Making a non-final class final is MAJOR (breaks subclassing)
- Changing the type of a builder method parameter is MAJOR

MINOR (backward-compatible additions):
- Adding new overloaded methods is MINOR
- Adding new public classes or interfaces is MINOR
- Adding new optional builder methods is MINOR
- Adding new enum values when NOT used in exhaustive switch statements is MINOR
- Adding new optional fields to request objects is MINOR
- Adding new exception/error classes is MINOR
- Adding new static utility methods is MINOR
- Adding new environment/server URL constants is MINOR
- Adding new RequestOptions fields (e.g. timeout, retries) is MINOR
- Widening a parameter type (e.g. String to Object) is MINOR
- Adding default methods to interfaces (Java 8+) is MINOR
- Deprecating (but not removing) public APIs with @Deprecated is MINOR

PATCH (no API surface change):
- Changes to package-private or private methods are PATCH
- Changes to annotations (other than public API annotations), Javadoc, or formatting are PATCH
- Updating SDK version headers (X-Fern-SDK-Version, User-Agent) is PATCH
- Refactoring OkHttp/HttpClient internals without changing observable defaults or behavior is PATCH
- Updating dependency versions in build.gradle/pom.xml is PATCH
- Refactoring internal implementation without changing public signatures is PATCH
- Updating serialization/deserialization logic (Jackson/Gson config) that preserves public types is PATCH
- Changes to test files, CI configuration, or build scripts are PATCH""",
    "go": """Language-specific breaking change rules for Go:

MAJOR (breaking):
- Removing a required response field is always MAJOR
- Removing or renaming an exported function, method, or type is always MAJOR
- Making a response field a pointer type (e.g. string to *string) is MAJOR (callers must dereference)
- Changing a function signature (adding/removing parameters or return values) is MAJOR (Go has no overloading)
- Removing or renaming an exported struct field is MAJOR
- Changing the type of an exported struct field is MAJOR
- Removing or renaming an exported constant or variable is MAJOR
- Changing an interface by adding methods is MAJOR (all implementations must add the method)
- Removing a method from an interface is MAJOR (callers using that method break)
- Changing a function's return type(s) is MAJOR (Go is strict about return types)
- Changing a variadic parameter to non-variadic (or vice versa) is MAJOR
- Moving a type/function to a different package without aliasing in the original is MAJOR
- Changing the receiver type of a method (value receiver to pointer receiver changes method set) is MAJOR
- Changing an exported error variable's type or value is MAJOR (callers using errors.Is break)

MINOR (backward-compatible additions):
- Adding new exported functions, methods, or types is MINOR
- New enum-like constants are MINOR (Go enums are not exhaustive by default)
- Adding new fields to a struct is MINOR (existing code still compiles, zero-value initialization)
- Making a response field optional (pointer) is usually MINOR if the field was already a struct field
- Adding new optional function parameters via functional options pattern is MINOR
- Adding new interface types is MINOR
- Adding new error types/variables is MINOR
- Adding new environment/server URL constants is MINOR
- Adding new RequestOption functions is MINOR
- Widening a return type from a concrete type to an interface is MINOR (if interface is satisfied)
- Adding new methods to a concrete type (does not break interface implementations) is MINOR

PATCH (no API surface change):
- Changes to unexported (lowercase) functions or types are PATCH
- Changes to go.mod dependencies, import reordering, or formatting are PATCH
- Updating SDK version headers (X-Fern-SDK-Version, User-Agent) is PATCH
- Refactoring http.Client internals without changing observable defaults or behavior is PATCH
- Updating serialization/deserialization logic (JSON tags, encoding) that preserves identical output is PATCH
- Refactoring internal implementation without changing exported signatures is PATCH
- Changes to *_test.go files, Makefile, or CI configuration are PATCH
- Updating comments, godoc, or code formatting (gofmt) is PATCH""",
    "ruby": """Language-specific breaking change rules for Ruby:

MAJOR (breaking):
- Removing a required response field is always MAJOR
- Removing or renaming a public method is MAJOR (callers get NoMethodError)
- Adding a new required positional parameter is MAJOR
- Removing a method parameter is MAJOR (callers passing that argument get ArgumentError)
- Changing the order of positional parameters is MAJOR
- Removing or renaming a public class or module is MAJOR (callers get NameError)
- Changing a method from instance to class method (or vice versa) is MAJOR
- Changing the return type in a breaking way (e.g. returning nil where an object
  was expected and callers chain methods) is MAJOR
- Removing a public constant is MAJOR
- Changing exception types raised by a method is MAJOR (callers rescuing specific exceptions break)

MINOR (backward-compatible additions):
- Making a response field optional is usually MINOR (Ruby uses nil propagation; callers rarely type-check)
- New enum values are MINOR (unknown values are handled gracefully)
- Adding new optional keyword parameters (with defaults) is MINOR
- Adding new public methods or classes is MINOR
- Adding new optional fields to response/request objects is MINOR
- Adding new exception/error classes is MINOR
- Adding new environment/server URL constants is MINOR
- Adding new RequestOptions fields (e.g. timeout, max_retries) is MINOR
- Deprecating (but not removing) a public API is MINOR
- Adding new modules or mixins is MINOR

PATCH (no API surface change):
- Changes to private methods are PATCH
- Gemspec metadata, comment, or formatting changes are PATCH
- Updating SDK version headers is PATCH
- Refactoring Faraday/Net::HTTP internals without changing observable defaults or behavior is PATCH
- Updating dependency versions in Gemfile/gemspec is PATCH
- Refactoring internal implementation without changing public signatures is PATCH
- Changes to test files, Rakefile, or CI configuration are PATCH""",
    "csharp": """Language-specific breaking change rules for C#:

MAJOR (breaking):
- Removing a required response field is always MAJOR
- Removing or renaming a public class, method, property, or interface is always MAJOR
- Making a response field nullable (e.g. T to T?) is MAJOR (callers must handle null checks)
- New enum values are MAJOR if the SDK generates exhaustive switch expressions
- Adding a new required parameter to a public method is MAJOR
- Changing a method's return type is MAJOR
- Removing or changing a public constant or static readonly field is MAJOR
- Changing a class from non-sealed to sealed (or abstract to concrete) is MAJOR
- Changing the base class of a public class is MAJOR
- Removing an interface implementation from a public class is MAJOR
- Changing generic type constraints on a public class or method is MAJOR
- Moving a public type to a different namespace without type forwarding is MAJOR
- Changing property from read-write to read-only (removing setter) is MAJOR
- Changing async method to sync (Task<T> to T) or vice versa is MAJOR

MINOR (backward-compatible additions):
- Adding new public classes, interfaces, or methods is MINOR
- Adding new optional parameters (with default values) is MINOR
- Adding new overloaded methods is MINOR
- Adding new enum values when NOT used in exhaustive switch expressions is MINOR
- Adding new optional properties to request objects is MINOR
- Adding new exception types is MINOR
- Adding new environment/server URL constants is MINOR
- Adding new RequestOptions fields (e.g. Timeout, MaxRetries) is MINOR
- Adding new extension methods is MINOR
- Deprecating (but not removing) public APIs with [Obsolete] is MINOR

PATCH (no API surface change):
- Changes to internal or private members are PATCH
- XML doc comments, formatting, or namespace reorganization are PATCH
- Updating SDK version headers is PATCH
- Refactoring HttpClient internals without changing observable defaults or behavior is PATCH
- Updating dependency versions in .csproj is PATCH
- Refactoring internal implementation without changing public signatures is PATCH
- Updating serialization/deserialization (System.Text.Json/Newtonsoft) config that preserves public types is PATCH
- Changes to test files, .sln, or CI configuration are PATCH""",
    "php": """Language-specific breaking change rules for PHP:

MAJOR (breaking):
- Removing a required response field is always MAJOR
- Removing or renaming a public method or class is always MAJOR
- Changing a method signature (adding required parameters) is MAJOR
- Removing a method parameter is MAJOR
- Changing the type declaration of a parameter to an incompatible type is MAJOR
- Removing or renaming a public constant is MAJOR
- Changing a class from non-final to final is MAJOR (breaks extension)
- Removing an interface implementation from a public class is MAJOR
- Changing the return type declaration to an incompatible type is MAJOR
- Moving a class to a different namespace without aliasing is MAJOR
- Changing exception types thrown by a method is MAJOR

MINOR (backward-compatible additions):
- Making a response field nullable is MINOR in most cases (PHP is dynamically typed)
- Adding new optional parameters (with defaults) is MINOR
- Adding new public classes or methods is MINOR
- New enum cases are usually MINOR (PHP enums are not typically used in exhaustive matches)
- Adding new optional fields to request/response objects is MINOR
- Adding new exception classes is MINOR
- Adding new environment/server URL constants is MINOR
- Adding new traits or interfaces is MINOR
- Adding new RequestOptions fields is MINOR
- Deprecating (but not removing) public APIs is MINOR

PATCH (no API surface change):
- Changes to private/protected methods are PATCH
- PHPDoc, formatting, or composer.json metadata changes are PATCH
- Updating SDK version headers is PATCH
- Refactoring Guzzle/cURL internals without changing observable defaults or behavior is PATCH
- Updating dependency versions in composer.json is PATCH
- Refactoring internal implementation without changing public signatures is PATCH
- Changes to test files, phpunit.xml, or CI configuration are PATCH""",
    "swift": """Language-specific breaking change rules for Swift:

MAJOR (breaking):
- Removing a required response field is always MAJOR
- Removing or renaming a public method, property, or type is always MAJOR
- Making a response field optional (T to T?) is MAJOR (callers must unwrap with if-let/guard)
- New enum cases are MAJOR (Swift switch statements must be exhaustive unless using default)
- Adding a new required parameter to a public method is MAJOR
- Changing the type of a public property is MAJOR
- Removing or changing a public protocol requirement is MAJOR
- Removing protocol conformance from a public type is MAJOR
- Changing a struct to a class (or vice versa) is MAJOR (value vs reference semantics)
- Making a public initializer failable (init to init?) or vice versa is MAJOR
- Changing the associated values of an enum case is MAJOR
- Removing a public typealias is MAJOR
- Changing access level from public to internal/private is MAJOR

MINOR (backward-compatible additions):
- Adding new public types, methods, or properties is MINOR
- Adding new optional parameters (with default values) is MINOR
- Adding new enum cases when callers use default in switch is MINOR
- Adding new protocol extensions with default implementations is MINOR
- Adding new optional fields to request/response structs is MINOR
- Adding new error types is MINOR
- Adding new environment/server URL constants is MINOR
- Adding new RequestOptions fields is MINOR
- Adding new convenience initializers is MINOR
- Deprecating (but not removing) public APIs with @available(*, deprecated) is MINOR

PATCH (no API surface change):
- Changes to internal or private members are PATCH
- Formatting, comments, or documentation changes are PATCH
- Updating SDK version headers is PATCH
- Refactoring URLSession internals without changing observable defaults or behavior is PATCH
- Updating dependency versions in Package.swift is PATCH
- Refactoring internal implementation without changing public signatures is PATCH
- Changes to test files, xcconfig, or CI configuration are PATCH""",
    "rust": """Language-specific breaking change rules for Rust:

MAJOR (breaking):
- Removing a required response field is always MAJOR
- Removing or renaming a public function, struct, enum, or trait is always MAJOR
- Making a response field optional (T to Option<T>) is MAJOR (callers must handle the Option)
- New enum variants are MAJOR (Rust match statements must be exhaustive unless using _ wildcard)
- Adding a new required field to a public struct is MAJOR (unless #[non_exhaustive])
- Removing a public trait implementation is MAJOR
- Changing a function's return type is MAJOR
- Adding a required method to a public trait is MAJOR (all implementations must add it)
- Changing the type of a public struct field is MAJOR
- Removing or renaming a public module is MAJOR
- Making a public type private (pub to pub(crate) or removing pub) is MAJOR
- Changing a struct from non-exhaustive to exhaustive construction (removing .. Default::default()) is MAJOR
- Changing generic type parameters or their bounds on public types is MAJOR
- Changing from Result<T, E1> to Result<T, E2> where E2 is a different error type is MAJOR
- Removing a public constant or static is MAJOR

MINOR (backward-compatible additions):
- Adding new public functions, structs, or enums is MINOR
- Adding new optional fields to #[non_exhaustive] structs is MINOR
- Adding new enum variants to #[non_exhaustive] enums is MINOR
- Adding new trait implementations for existing types is MINOR
- Adding new public constants or statics is MINOR
- Adding new methods to existing impl blocks is MINOR
- Adding new error types is MINOR
- Adding new environment/server URL constants is MINOR
- Adding new RequestOptions fields is MINOR
- Adding new optional builder methods is MINOR
- Deprecating (but not removing) public APIs with #[deprecated] is MINOR

PATCH (no API surface change):
- Changes to pub(crate) or private items are PATCH
- Cargo.toml metadata, formatting, or comment changes are PATCH
- Updating SDK version headers is PATCH
- Refactoring reqwest/hyper internals without changing observable defaults or behavior is PATCH
- Updating dependency versions in Cargo.toml is PATCH
- Refactoring internal implementation without changing public signatures is PATCH
- Updating serialization/deserialization (serde) config that preserves public types is PATCH
- Changes to test files, build.rs, or CI configuration are PATCH""",
    "kotlin": """Language-specific breaking change rules for Kotlin:

MAJOR (breaking):
- Removing a required response field is always MAJOR
- Removing or renaming a public function, class, or property is always MAJOR
- Making a response field nullable (T to T?) is MAJOR (callers must handle null safety operators)
- New enum values are MAJOR if used in when() expressions without else branch
- Adding a new required parameter to a public function is MAJOR
- Changing a method's return type is MAJOR
- Removing or changing a public constant (const val / companion object val) is MAJOR
- Changing a class from open to final (or data class to regular class) is MAJOR
- Removing an interface implementation from a public class is MAJOR
- Changing generic type parameters or their variance (in/out) on public types is MAJOR
- Moving a public class to a different package without type aliasing is MAJOR
- Changing a property from var to val (or removing a setter) is MAJOR
- Changing a suspend function to non-suspend (or vice versa) is MAJOR
- Changing sealed class/interface hierarchy (removing subclasses) is MAJOR

MINOR (backward-compatible additions):
- Adding new public classes, functions, or extension functions is MINOR
- Adding new optional parameters (with default values) is MINOR
- Adding new enum values when callers use else in when() is MINOR
- Adding new optional properties to data classes is MINOR
- Adding new exception types is MINOR
- Adding new environment/server URL constants is MINOR
- Adding new RequestOptions fields is MINOR
- Adding new sealed class/interface subtypes is MINOR (if callers have else branch)
- Deprecating (but not removing) public APIs with @Deprecated is MINOR
- Adding new companion object functions is MINOR

PATCH (no API surface change):
- Changes to internal or private members are PATCH
- KDoc, formatting, or build.gradle changes are PATCH
- Updating SDK version headers is PATCH
- Refactoring OkHttp internals without changing observable defaults or behavior is PATCH
- Updating dependency versions in build.gradle.kts is PATCH
- Refactoring internal implementation without changing public signatures is PATCH
- Updating serialization/deserialization (kotlinx.serialization/Moshi) config that preserves public types is PATCH
- Changes to test files or CI configuration are PATCH""",
}

GENERIC_LANGUAGE_RULES = """Language-specific breaking change rules (language: {language}):

MAJOR (breaking):
- Removing a required response field is always MAJOR
- Removing or renaming a public class, method, or function is always MAJOR
- Making a response field optional is MAJOR in statically-typed languages
  (TypeScript, Java, C#, Swift, Rust, Kotlin, Go), usually MINOR in
  dynamically-typed ones (Python, Ruby, PHP)
- New enum values are MAJOR if the language enforces exhaustive matching
  (TypeScript, Java, C#, Swift, Rust), MINOR otherwise
- Adding a new required parameter to a public method is MAJOR
- Changing a method's return type is MAJOR
- Changing the type of an existing field/property is MAJOR
- Removing or changing public constants is MAJOR

MINOR (backward-compatible additions):
- Adding new public APIs (classes, methods, functions) is MINOR
- Adding new optional parameters is MINOR
- Adding new optional fields to request/response objects is MINOR
- Adding new error/exception types is MINOR
- Deprecating (but not removing) public APIs is MINOR

PATCH (no API surface change):
- Internal/private changes are PATCH
- Formatting, documentation, or comment changes are PATCH
- Dependency version updates are PATCH
- SDK version header updates are PATCH
- Refactoring retry/timeout internals without changing observable defaults or behavior is PATCH
- Refactoring internals without changing public signatures is PATCH"""


def _build_prompt(
    diff: str,
    language: str | None = None,
    previous_version: str | None = None,
    prior_changelog: str | None = None,
    spec_commit_message: str | None = None,
) -> str:
    sections: list[str] = []

    sections.append(
        "You are an expert software engineer analyzing changes to generate semantic commit messages.\n\n"
        "Analyze the provided git diff and return a structured response with these fields:\n"
        "- message: A git commit message formatted like the example below\n"
        "- changelog_entry: A user-facing release note for CHANGELOG.md and GitHub Releases\n"
        "- version_bump: One of: MAJOR, MINOR, PATCH, or NO_CHANGE\n"
        "- version_bump_reason: One sentence explaining WHY this version bump was chosen"
    )

    guidelines = (
        "\n\nVersion Bump Guidelines:\n"
        "- MAJOR: Breaking changes (removed/renamed functions, changed signatures, removed parameters)\n"
        "- MINOR: New features that are backward compatible (new functions, new optional parameters)."
    )
    if language:
        guidelines += (
            "\n  Also MINOR: behavioral changes invisible to the public API surface that still affect consumers:\n"
            "  - Changed HTTP status code handling (e.g. 404 now throws instead of returning null)\n"
            "  - Changed default parameter values (timeout, retry count, page size, base URL)\n"
            "  - Changed serialization behavior (date formats, null handling, field ordering)\n"
            "  - Changed error message text that consumers may depend on\n"
            "  - Changed HTTP header names or values sent to the server\n"
            "  - Changed retry or backoff behavior (different retry counts, delay strategies)"
        )
    guidelines += (
        "\n- PATCH: Bug fixes, documentation, internal refactoring with no observable behavioral change\n"
        "- NO_CHANGE: The diff is empty"
    )
    sections.append(guidelines)

    sections.append(
        "\n\n--- Examples ---\n\n"
        "Examples of correct classifications:\n\n"
        "--- MAJOR: removed exported TypeScript function ---\n"
        "diff --git a/src/api/client.ts b/src/api/client.ts\n"
        "-export async function getUser(id: string): Promise<User> {\n"
        '-    return this.request("GET", `/users/${id}`);\n'
        "-}\n"
        "version_bump: MAJOR\n"
        "reason: Existing callers of getUser() will get a compile error.\n\n"
        "--- MAJOR: removed Python public method ---\n"
        "diff --git a/vital/client.py b/vital/client.py\n"
        "-    def get_user(self, user_id: str) -> User:\n"
        '-        return self._request("GET", f"/users/{user_id}")\n'
        "version_bump: MAJOR\n"
        "reason: Existing callers crash with AttributeError.\n\n"
        "--- MINOR: new optional TypeScript parameter ---\n"
        "diff --git a/src/api/client.ts b/src/api/client.ts\n"
        "-async createUser(name: string): Promise<User>\n"
        "+async createUser(name: string, role?: UserRole): Promise<User>\n"
        "version_bump: MINOR\n"
        "reason: Existing callers unaffected \u2014 new parameter is optional.\n\n"
        "--- MINOR: new Java public method ---\n"
        "diff --git a/src/.../UsersClient.java b/src/.../UsersClient.java\n"
        "+    public CompletableFuture<User> getUserAsync(String userId) {\n"
        "+        return this.httpClient.sendAsync(...);\n"
        "+    }\n"
        "version_bump: MINOR\n"
        "reason: New capability added, nothing removed or changed.\n\n"
        "--- MINOR: changed default retry count ---\n"
        "diff --git a/src/core/http_client.py b/src/core/http_client.py\n"
        "-MAX_RETRIES = 3\n"
        "+MAX_RETRIES = 5\n"
        "version_bump: MINOR\n"
        "reason: Changed default retry count \u2014 existing consumers will experience different retry behavior.\n\n"
        "--- PATCH: Go import reorganization ---\n"
        "diff --git a/client.go b/client.go\n"
        '-import "fmt"\n'
        '-import "net/http"\n'
        "+import (\n"
        '+    "fmt"\n'
        '+    "net/http"\n'
        "+)\n"
        "version_bump: PATCH\n"
        "reason: Formatting change only, no functional difference.\n\n"
        "--- End Examples ---"
    )

    if language:
        lang_key = language.lower().strip()
        rules = LANGUAGE_RULES.get(lang_key)
        if rules:
            sections.append(f"\n\n{rules}")
        else:
            sections.append(f"\n\n{GENERIC_LANGUAGE_RULES.format(language=language)}")

    sections.append(
        "\n\nApply these patterns to the diff below. When in doubt between MINOR and PATCH, "
        "prefer MINOR. When in doubt between MAJOR and MINOR, examine whether existing "
        "callers would break without any code changes on their side."
    )

    sections.append(
        "\n\nMessage Format (use this exact structure):\n"
        "```\n"
        "<type>: <short summary>\n\n"
        "<detailed description of what changed and why it matters>\n\n"
        "Key changes:\n"
        "- <change 1>\n"
        "- <change 2>\n"
        "- <change 3>\n\n"
        "\U0001f33f Generated with Fern\n"
        "```"
    )

    sections.append(
        "\n\nMessage Guidelines:\n"
        "- Use conventional commit types: feat, fix, refactor, docs, chore, test, style, perf\n"
        "- Keep the summary line under 72 characters\n"
        '- Write in present tense imperative mood ("add" not "added" or "adds")\n'
        "- For breaking changes: include migration instructions in the detailed description\n"
        "- For new features: highlight new capabilities in the key changes\n"
        "- For PATCH: describe the fix or improvement\n"
        '- For NO_CHANGE: use type "chore" and state that no functional changes were made\n'
        "- Be specific and action-oriented\n"
        '- Always end with the "\U0001f33f Generated with Fern" footer\n'
        '- Do not use "Fern regeneration" in commit messages \u2014 use "SDK regeneration" instead\n'
        '- NEVER include the literal version "505.503.4455" in the commit message \u2014 if you see this placeholder\n'
        '  in the diff, describe changes generically (e.g., "added X-Fern-SDK-Version header")'
    )

    if previous_version:
        sections.append(
            "\n- The previous version is provided for context only. Do not include it "
            "literally in the commit message summary line."
        )

    if prior_changelog:
        sections.append(
            f"\n\nPrior changelog entries (for style reference):\n---\n{prior_changelog}\n---\n"
            "Match the tone and format of these entries in your commit message."
        )

    if spec_commit_message:
        sections.append(
            "\n\nThe API spec change that triggered this SDK generation had the following commit message:\n"
            f'"{spec_commit_message}"\n'
            "Use this as a hint for understanding the intent of the change, but always verify "
            "against the actual diff below. The commit message may be vague or inaccurate."
        )

    if previous_version:
        sections.append(f"\n\nPrevious version: {previous_version}")
    if language:
        sections.append(f"\nSDK language: {language}")

    sections.append(f"\n\nGit Diff:\n---\n{diff}\n---")

    sections.append(
        "\n\nChangelog Entry Guidelines:\n"
        "- Write for SDK consumers, not engineers reading the source code\n"
        '- MAJOR: explain what broke and how to migrate ("The `getUser` method has been\n'
        '  removed. Replace calls with `fetchUser(id)` which returns the same type.")\n'
        '- MINOR: describe the new capability ("New `createPayment()` method available\n'
        '  on `PaymentsClient`.")\n'
        "- PATCH: leave empty string \u2014 patch changes don't warrant changelog entries\n"
        "- NO_CHANGE: leave empty string\n"
        '- Do not use conventional commit prefixes (no "feat:", "fix:", etc.)\n'
        '- Write in third person ("The SDK now supports..." not "Add support for...")\n'
        "- Keep it concise: one to three sentences"
    )

    sections.append(
        "\n\nRemember again that YOU MUST return a structured JSON response with these four fields:\n"
        "- message: A git commit message formatted like the example previously provided\n"
        "- changelog_entry: A user-facing release note (empty string for PATCH)\n"
        "- version_bump: One of: MAJOR, MINOR, PATCH, or NO_CHANGE\n"
        "- version_bump_reason: One sentence explaining WHY this bump level was chosen. "
        "For MAJOR: name the specific breaking symbol(s). For MINOR: name the new capability. "
        "For PATCH: describe the fix. For NO_CHANGE: 'No functional changes detected.'"
    )

    result = "".join(sections)
    return result.replace("{", "{{").replace("}", "}}")


async def _analyze_single_chunk(
    diff: str,
    language: str | None = None,
    previous_version: str | None = None,
    prior_changelog: str | None = None,
    spec_commit_message: str | None = None,
) -> AnalyzeCommitDiffResponse | None:
    prompt = _build_prompt(
        diff=diff,
        language=language,
        previous_version=previous_version,
        prior_changelog=prior_changelog,
        spec_commit_message=spec_commit_message,
    )
    return await generate_anthropic_generic_async(
        response_type=AnalyzeCommitDiffResponse,
        prompt_template=prompt,
        model="claude-4-sonnet-20250514",
    )


CONSOLIDATE_CHANGELOG_PROMPT = """You are a technical writer formatting release notes for a {language} SDK.

The raw change notes below are noisy and repetitive \u2014 many bullets describe the same
change across different packages. Deduplicate aggressively: if the same feature appears
multiple times, merge into one entry.

Raw changelog entries:
---
{raw_entries}
---

Overall version bump: {version_bump}

Produce three outputs:

---

## 1. CHANGELOG.md entry (Keep a Changelog format)

- Group under: `### Breaking Changes`, `### Added`, `### Changed`, `### Fixed`
- Only include sections with entries
- **Bold the symbol name** first, then one tight sentence for SDK consumers
- No code fences \u2014 prose only
- For breaking changes, append the migration action inline

## 2. PR Description

- `## Breaking Changes` section at top (if any)
  - One `###` per breaking change with **Before/After** code fences and a **Migration:** line
- `## What's New` section summarizing added/changed features in prose paragraphs,
  grouped by theme (e.g. logging, streaming, pagination, builder improvements)
- Do NOT list every class that got the same method \u2014 summarize as a single entry

## 3. Version Bump Reason

- One sentence explaining WHY the overall version bump ({version_bump}) was chosen
- For MAJOR: name the specific breaking symbol(s) and explain why existing callers break
- For MINOR: name the new capability added
- For PATCH: describe what was fixed or improved
- Example: "MAJOR because `parserCreateJob` InputStream overloads were removed
  from `RawLabReportClient`, breaking existing callers."

---

Return the three outputs as JSON with keys "consolidated_changelog", "pr_description", and "version_bump_reason"."""


async def _consolidate_changelog(
    raw_entries: str,
    version_bump: str,
    language: str,
) -> ConsolidateChangelogResponse | None:
    result = await generate_anthropic_generic_async(
        response_type=ConsolidateChangelogResponse,
        prompt_template=CONSOLIDATE_CHANGELOG_PROMPT,
        model="claude-4-sonnet-20250514",
        max_tokens=4096,
        raw_entries=raw_entries,
        version_bump=version_bump,
        language=language,
    )
    if result is not None and result.consolidated_changelog.strip():
        return result
    return None


async def _analyze_chunked_diff(
    diff: str,
    language: str | None = None,
    previous_version: str | None = None,
    prior_changelog: str | None = None,
    spec_commit_message: str | None = None,
) -> AnalyzeCommitDiffResponse | None:
    diff_byte_size = len(diff.encode("utf-8"))

    if diff_byte_size > MAX_RAW_DIFF_BYTES:
        LOGGER.warning(
            f"Diff too large for analysis ({diff_byte_size / 1_000_000:.1f}MB, "
            f"limit {MAX_RAW_DIFF_BYTES / 1_000_000}MB). Rejecting."
        )
        raise HTTPException(
            status_code=413,
            detail=(
                f"Diff is too large ({diff_byte_size / 1_000_000:.1f}MB). "
                f"Maximum allowed is {MAX_RAW_DIFF_BYTES / 1_000_000}MB."
            ),
        )

    if diff_byte_size <= MAX_AI_DIFF_BYTES:
        return await _analyze_single_chunk(diff, language, previous_version, prior_changelog, spec_commit_message)

    chunks = chunk_diff(diff, MAX_AI_DIFF_BYTES)
    total_chunks = len(chunks)

    if total_chunks > MAX_CHUNKS:
        LOGGER.info(
            f"Split into {total_chunks} chunks for analysis "
            f"(capped at {MAX_CHUNKS}, skipping {total_chunks - MAX_CHUNKS} low-priority chunks)."
        )
        chunks = chunks[:MAX_CHUNKS]
    else:
        LOGGER.info(f"Split diff ({diff_byte_size} bytes) into {total_chunks} chunks for analysis.")

    best_bump = VersionBump.NO_CHANGE
    best_message: str | None = None
    best_version_bump_reason: str = ""
    changelog_entries: list[str] = []
    any_success = False

    for idx, chunk in enumerate(chunks):
        try:
            result = await _analyze_single_chunk(
                chunk, language, previous_version, prior_changelog, spec_commit_message
            )
            if result is None:
                LOGGER.warning(f"Chunk {idx + 1}/{len(chunks)} returned no result, skipping.")
                continue

            any_success = True

            merged_str = max_version_bump(result.version_bump.value, best_bump.value)
            if merged_str != best_bump.value:
                best_bump = VersionBump(merged_str)
                best_message = result.message
                best_version_bump_reason = (
                    result.version_bump_reason or ""
                ).strip()
            elif best_message is None:
                best_message = result.message
                best_version_bump_reason = (
                    result.version_bump_reason or ""
                ).strip()

            if result.changelog_entry and result.changelog_entry.strip():
                changelog_entries.append(result.changelog_entry.strip())

            LOGGER.info(f"Chunk {idx + 1}/{len(chunks)}: bump={result.version_bump.value}")

        except Exception:
            LOGGER.exception(f"Error analyzing chunk {idx + 1}/{len(chunks)}")

    if not any_success:
        return None

    aggregated_changelog = ""
    version_bump_reason = best_version_bump_reason
    if len(changelog_entries) == 1:
        aggregated_changelog = changelog_entries[0]
    elif len(changelog_entries) > 1:
        raw_entries = "\n".join(
            entry if entry.startswith("- ") else f"- {entry}" for entry in changelog_entries
        )
        try:
            LOGGER.info(
                f"Consolidating {len(changelog_entries)} changelog entries via AI rollup"
            )
            consolidated = await _consolidate_changelog(
                raw_entries=raw_entries,
                version_bump=best_bump.value,
                language=language or "unknown",
            )
            if consolidated is not None:
                aggregated_changelog = consolidated.consolidated_changelog.strip()
                version_bump_reason = (consolidated.version_bump_reason or "").strip()
            else:
                aggregated_changelog = raw_entries
        except Exception:
            LOGGER.exception("Changelog consolidation failed, using raw entries")
            aggregated_changelog = raw_entries

    return AnalyzeCommitDiffResponse(
        message=best_message or "chore: update SDK\n\nGenerated with Fern",
        version_bump=best_bump,
        changelog_entry=aggregated_changelog,
        version_bump_reason=version_bump_reason,
    )


@fai_app.post(
    "/sdks/analyze-commit-diff",
    response_model=AnalyzeCommitDiffResponse,
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
)
async def analyze_commit_diff(
    body: AnalyzeCommitDiffRequest = Body(...),
    _token: str = Depends(verify_org_token),
) -> JSONResponse:
    try:
        result = await _analyze_chunked_diff(
            diff=body.diff,
            language=body.language,
            previous_version=body.previous_version,
            prior_changelog=body.prior_changelog,
            spec_commit_message=body.spec_commit_message,
        )

        if result is None:
            LOGGER.error("Failed to analyze commit diff after retries")
            return JSONResponse(
                status_code=500,
                content={"detail": "Failed to analyze commit diff after multiple attempts"},
            )

        LOGGER.info(f"Successfully analyzed commit diff with version bump: {result.version_bump}")
        return JSONResponse(content=jsonable_encoder(result))

    except HTTPException:
        raise
    except Exception as e:
        LOGGER.exception("Failed to analyze commit diff")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.post(
    "/sdks/consolidate-changelog",
    response_model=ConsolidateChangelogResponse,
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
)
async def consolidate_changelog(
    body: ConsolidateChangelogRequest = Body(...),
    _token: str = Depends(verify_org_token),
) -> JSONResponse:
    try:
        result = await _consolidate_changelog(
            raw_entries=body.raw_entries,
            version_bump=body.version_bump,
            language=body.language,
        )

        if result is None:
            LOGGER.error("Failed to consolidate changelog after retries")
            return JSONResponse(
                status_code=500,
                content={"detail": "Failed to consolidate changelog after multiple attempts"},
            )

        LOGGER.info("Successfully consolidated changelog")
        return JSONResponse(content=jsonable_encoder(result))

    except Exception as e:
        LOGGER.exception("Failed to consolidate changelog")
        return JSONResponse(status_code=500, content={"detail": str(e)})
