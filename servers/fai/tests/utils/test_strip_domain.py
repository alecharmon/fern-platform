from fai.dependencies import strip_domain


class TestStripDomain:
    def test_domain_without_protocol_or_path(self) -> None:
        assert strip_domain("website.com") == "website.com"

    def test_domain_with_https_protocol(self) -> None:
        assert strip_domain("https://website.com") == "website.com"

    def test_domain_with_http_protocol(self) -> None:
        assert strip_domain("http://website.com") == "website.com"

    def test_domain_with_protocol_and_path(self) -> None:
        assert strip_domain("https://website.com/docs") == "website.com"

    def test_domain_with_protocol_and_multiple_path_segments(self) -> None:
        assert strip_domain("https://website.com/docs/api/v1") == "website.com"

    def test_domain_with_path_but_no_protocol(self) -> None:
        assert strip_domain("website.com/docs") == "website.com"

    def test_domain_with_subdomain(self) -> None:
        assert strip_domain("https://docs.website.com") == "docs.website.com"

    def test_domain_with_subdomain_and_path(self) -> None:
        assert strip_domain("https://docs.website.com/api") == "docs.website.com"

    def test_domain_with_trailing_slash(self) -> None:
        assert strip_domain("https://website.com/") == "website.com"

    def test_domain_with_whitespace(self) -> None:
        assert strip_domain("  website.com  ") == "website.com"

    def test_domain_with_protocol_and_whitespace(self) -> None:
        assert strip_domain("  https://website.com/docs  ") == "website.com"

    def test_domain_with_port(self) -> None:
        assert strip_domain("https://website.com:8080/docs") == "website.com:8080"

    def test_buildwithfern_domain(self) -> None:
        assert strip_domain("https://docs.buildwithfern.com/docs") == "docs.buildwithfern.com"

    def test_domain_with_query_string_no_protocol(self) -> None:
        assert strip_domain("website.com?foo=bar") == "website.com"

    def test_domain_with_query_string_and_protocol(self) -> None:
        assert strip_domain("https://website.com?foo=bar") == "website.com"

    def test_domain_with_fragment_no_protocol(self) -> None:
        assert strip_domain("website.com#section") == "website.com"

    def test_domain_with_fragment_and_protocol(self) -> None:
        assert strip_domain("https://website.com#section") == "website.com"

    def test_domain_with_path_and_query_string(self) -> None:
        assert strip_domain("https://website.com/docs?foo=bar") == "website.com"

    def test_domain_with_path_and_fragment(self) -> None:
        assert strip_domain("https://website.com/docs#section") == "website.com"
