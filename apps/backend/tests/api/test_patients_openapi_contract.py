from __future__ import annotations

from app.main import create_app
from tests._settings import build_settings

EXPECTED_OPERATIONS = {
    ("/patients", "get", "list_patients"),
    ("/patients", "post", "create_patient"),
    ("/patients/{patient_id}", "get", "get_patient"),
    ("/patients/{patient_id}", "patch", "update_patient"),
    ("/patients/{patient_id}", "delete", "soft_delete_patient"),
}


def test_patients_openapi_surface() -> None:
    app = create_app(build_settings())
    spec = app.openapi()
    paths = spec["paths"]

    for path, method, operation_id in EXPECTED_OPERATIONS:
        assert path in paths, f"missing path {path}"
        operation = paths[path].get(method)
        assert operation is not None, f"missing {method.upper()} {path}"
        assert operation["operationId"] == operation_id

    list_response = paths["/patients"]["get"]["responses"]["200"]["content"]["application/json"][
        "schema"
    ]
    # Page envelope is generic over PatientRead; openapi names it `Page_PatientRead_`.
    assert list_response["$ref"].endswith("/Page_PatientRead_")

    create_response = paths["/patients"]["post"]["responses"]["201"]["content"]["application/json"][
        "schema"
    ]
    assert create_response["$ref"].endswith("/PatientRead")

    delete_responses = paths["/patients/{patient_id}"]["delete"]["responses"]
    assert "204" in delete_responses
