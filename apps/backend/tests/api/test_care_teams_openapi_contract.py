from __future__ import annotations

from app.main import create_app
from tests._settings import build_settings

EXPECTED_OPERATIONS = {
    ("/patients/{patient_id}/care-teams", "get", "list_patient_care_teams"),
    ("/patients/{patient_id}/care-teams", "post", "create_care_team"),
    ("/care-teams/{care_team_id}", "patch", "update_care_team"),
    ("/care-teams/{care_team_id}/participants", "post", "add_care_team_participant"),
    (
        "/care-teams/{care_team_id}/participants/{user_id}",
        "patch",
        "change_participant_role",
    ),
    (
        "/care-teams/{care_team_id}/participants/{user_id}",
        "delete",
        "unassign_care_team_participant",
    ),
}


def test_care_teams_openapi_surface() -> None:
    app = create_app(build_settings())
    spec = app.openapi()
    paths = spec["paths"]

    for path, method, operation_id in EXPECTED_OPERATIONS:
        assert path in paths, f"missing path {path}"
        operation = paths[path].get(method)
        assert operation is not None, f"missing {method.upper()} {path}"
        assert operation["operationId"] == operation_id

    list_response = paths["/patients/{patient_id}/care-teams"]["get"]["responses"]["200"][
        "content"
    ]["application/json"]["schema"]
    assert list_response["type"] == "array"
    assert list_response["items"]["$ref"].endswith("/CareTeamRead")

    create_response = paths["/patients/{patient_id}/care-teams"]["post"]["responses"]["201"][
        "content"
    ]["application/json"]["schema"]
    assert create_response["$ref"].endswith("/CareTeamRead")

    add_participant_response = paths["/care-teams/{care_team_id}/participants"]["post"][
        "responses"
    ]["201"]["content"]["application/json"]["schema"]
    assert add_participant_response["$ref"].endswith("/ParticipantRead")

    unassign_responses = paths["/care-teams/{care_team_id}/participants/{user_id}"]["delete"][
        "responses"
    ]
    assert "204" in unassign_responses
