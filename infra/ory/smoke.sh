#!/usr/bin/env bash
# Ory access-plane smoke test — runs locally and in CI (ory-smoke job).
# Proves the two contracts the backend swap depends on:
#   1. Kratos accepts an imported argon2id hash and a native login flow
#      against it yields a whoami-able session.
#   2. Keto answers a check after a tuple write, and denies after delete
#      (the episode-revocation semantics).
set -euo pipefail

KRATOS_PUBLIC=${KRATOS_PUBLIC:-http://localhost:4433}
KRATOS_ADMIN=${KRATOS_ADMIN:-http://localhost:4434}
KETO_READ=${KETO_READ:-http://localhost:4466}
KETO_WRITE=${KETO_WRITE:-http://localhost:4467}

EMAIL="smoke-$(date +%s)@zas.local"
PASSWORD="smoke-password-123"
# argon2id hash of $PASSWORD — mirrors the import path used by
# scripts/import_identities_kratos.py (hash import, no cleartext).
HASHED_PASSWORD='$argon2id$v=19$m=65536,t=3,p=4$xYSciXC2v8Ng1lKAPHyjrw$Ih8S4DS2y1J4vZBb+qbTJeKyHv/aLzcrg2vjfHF+8gM'

fail() { echo "SMOKE FAIL: $1" >&2; exit 1; }

echo "→ kratos: import identity with argon2id hashed_password"
identity_id=$(curl -fsS -X POST "$KRATOS_ADMIN/admin/identities" \
  -H 'Content-Type: application/json' \
  -d "{
    \"schema_id\": \"practitioner\",
    \"traits\": {\"email\": \"$EMAIL\"},
    \"credentials\": {\"password\": {\"config\": {\"hashed_password\": \"$HASHED_PASSWORD\"}}}
  }" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
[ -n "$identity_id" ] || fail "identity import returned no id"
echo "  identity: $identity_id"

echo "→ kratos: native login flow with the pre-hash password"
flow_id=$(curl -fsS "$KRATOS_PUBLIC/self-service/login/api" |
  python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
session_token=$(curl -fsS -X POST "$KRATOS_PUBLIC/self-service/login?flow=$flow_id" \
  -H 'Content-Type: application/json' \
  -d "{\"method\": \"password\", \"identifier\": \"$EMAIL\", \"password\": \"$PASSWORD\"}" |
  python3 -c 'import json,sys; print(json.load(sys.stdin)["session_token"])')
[ -n "$session_token" ] || fail "login flow returned no session_token"

echo "→ kratos: whoami resolves the session to the imported identity"
whoami_identity=$(curl -fsS "$KRATOS_PUBLIC/sessions/whoami" \
  -H "X-Session-Token: $session_token" |
  python3 -c 'import json,sys; print(json.load(sys.stdin)["identity"]["id"])')
[ "$whoami_identity" = "$identity_id" ] || fail "whoami identity mismatch"

echo "→ kratos: admin revocation kills the session"
curl -fsS -X DELETE "$KRATOS_ADMIN/admin/identities/$identity_id/sessions" >/dev/null
revoked_status=$(curl -s -o /dev/null -w '%{http_code}' "$KRATOS_PUBLIC/sessions/whoami" \
  -H "X-Session-Token: $session_token")
[ "$revoked_status" = "401" ] || fail "expected 401 after revocation, got $revoked_status"

subject="User:smoke-$(date +%s)"
object="smoke-patient"

# Keto answers 200 {"allowed": true} / 403 {"allowed": false} — no -f flag,
# both statuses carry a JSON body.
keto_check() {
  local relation=$1
  curl -sS -X POST "$KETO_READ/relation-tuples/check" \
    -H 'Content-Type: application/json' \
    -d "{\"namespace\": \"Patient\", \"object\": \"$object\", \"relation\": \"$relation\", \"subject_id\": \"$subject\"}" |
    python3 -c 'import json,sys; print(json.load(sys.stdin)["allowed"])'
}

keto_write() {
  local namespace=$1 obj=$2 relation=$3 subj=$4
  curl -fsS -X PUT "$KETO_WRITE/admin/relation-tuples" \
    -H 'Content-Type: application/json' \
    -d "{\"namespace\": \"$namespace\", \"object\": \"$obj\", \"relation\": \"$relation\", $subj}" >/dev/null
}

echo "→ keto: external_reader verb → view allowed, shielded/edit denied"
keto_write Patient "$object" external_reader "\"subject_id\": \"$subject\""
[ "$(keto_check view)" = "True" ] || fail "expected view=true for external_reader"
[ "$(keto_check view_shielded)" = "False" ] || fail "expected view_shielded=false for external_reader"
[ "$(keto_check edit)" = "False" ] || fail "expected edit=false for external_reader (verb separation)"

echo "→ keto: delete verb tuple → view denied (grant revocation)"
curl -fsS -X DELETE "$KETO_WRITE/admin/relation-tuples?namespace=Patient&object=$object&relation=external_reader&subject_id=$subject" >/dev/null
[ "$(keto_check view)" = "False" ] || fail "expected view=false after verb delete"

echo "→ keto: break_glass grants BOTH view tiers and edit"
keto_write Patient "$object" break_glass "\"subject_id\": \"$subject\""
[ "$(keto_check view_shielded)" = "True" ] || fail "expected view_shielded=true for break_glass"
[ "$(keto_check edit)" = "True" ] || fail "expected edit=true for break_glass"
curl -fsS -X DELETE "$KETO_WRITE/admin/relation-tuples?namespace=Patient&object=$object&relation=break_glass&subject_id=$subject" >/dev/null
[ "$(keto_check view_shielded)" = "False" ] || fail "expected view_shielded=false after break_glass delete"

echo "→ keto: carepath via specialism membership, then explicit-assignment shape"
carepath="smoke-carepath"
specialism="smoke-specialism"
carepath_check() {
  curl -sS -X POST "$KETO_READ/relation-tuples/check" \
    -H 'Content-Type: application/json' \
    -d "{\"namespace\": \"Carepath\", \"object\": \"$carepath\", \"relation\": \"view\", \"subject_id\": \"$subject\"}" |
    python3 -c 'import json,sys; print(json.load(sys.stdin)["allowed"])'
}
keto_write Specialism "$specialism" practitioner "\"subject_id\": \"$subject\""
keto_write Carepath "$carepath" specialism "\"subject_set\": {\"namespace\": \"Specialism\", \"object\": \"$specialism\", \"relation\": \"practitioner\"}"
[ "$(carepath_check)" = "True" ] || fail "expected carepath view=true via specialism membership"
curl -fsS -X DELETE "$KETO_WRITE/admin/relation-tuples?namespace=Specialism&object=$specialism&relation=practitioner&subject_id=$subject" >/dev/null
[ "$(carepath_check)" = "False" ] || fail "expected carepath view=false after specialism membership removed"
keto_write Carepath "$carepath" assigned "\"subject_id\": \"$subject\""
[ "$(carepath_check)" = "True" ] || fail "expected carepath view=true via explicit assignment"

# cleanup carepath fixtures
curl -fsS -X DELETE "$KETO_WRITE/admin/relation-tuples?namespace=Carepath&object=$carepath&relation=assigned&subject_id=$subject" >/dev/null
curl -fsS -X DELETE "$KETO_WRITE/admin/relation-tuples?namespace=Carepath&object=$carepath&relation=specialism" >/dev/null

echo "SMOKE OK"
