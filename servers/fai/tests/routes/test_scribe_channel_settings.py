from typing import Any

from fai.models.api.scribe_channel_settings import ScribeChannelSettings


class TestScribeChannelSettings:
    def test_default_settings(self) -> None:
        settings = ScribeChannelSettings()
        assert settings.repo_override is None

    def test_settings_with_repo_override(self) -> None:
        settings = ScribeChannelSettings(repo_override="owner/repo")
        assert settings.repo_override == "owner/repo"

    def test_settings_from_dict(self) -> None:
        settings_dict: dict[str, Any] = {"repo_override": "fern-api/fern-platform"}
        settings = ScribeChannelSettings(**settings_dict)
        assert settings.repo_override == "fern-api/fern-platform"

    def test_settings_from_dict_with_none(self) -> None:
        settings_dict: dict[str, Any] = {"repo_override": None}
        settings = ScribeChannelSettings(**settings_dict)
        assert settings.repo_override is None

    def test_settings_from_empty_dict(self) -> None:
        settings_dict: dict[str, Any] = {}
        settings = ScribeChannelSettings(**settings_dict)
        assert settings.repo_override is None
