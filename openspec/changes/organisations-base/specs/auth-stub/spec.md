## MODIFIED Requirements

### Requirement: `require_role` factory dep guards admin-only routes

The backend SHALL export a callable `require_role(*roles: Role)` from `app/services/auth/deps.py` (re-exported from `app/services/auth/__init__.py`) that returns a FastAPI dependency. The factory SHALL accept one or more `Role` values via variadic positional arguments. The returned dependency MUST resolve `CurrentUserDep` and raise `ForbiddenRoleError` (`forbidden.auth.role`, 403) when `current_user.role` is not in the set of accepted roles. When called with a single role, behaviour MUST match the prior single-role contract (no breakage at existing call sites).

#### Scenario: Allowed role passes (single-role guard)

- **WHEN** a route declares `Depends(require_role(Role.ADMIN))` and the current user has `role = Role.ADMIN`
- **THEN** the dependency MUST return the `SessionUser` and the handler MUST execute

#### Scenario: Disallowed role rejected (single-role guard)

- **WHEN** a route declares `Depends(require_role(Role.ADMIN))` and the current user has `role = Role.CAREGIVER`
- **THEN** the response MUST be 403 with `ErrorResponse{ code: "forbidden.auth.role" }`

#### Scenario: Any of multiple roles passes

- **WHEN** a route declares `Depends(require_role(Role.ADMIN, Role.CAREGIVER))` and the current user has `role = Role.CAREGIVER`
- **THEN** the dependency MUST return the `SessionUser` and the handler MUST execute

#### Scenario: None of the listed roles matches

- **WHEN** a route declares `Depends(require_role(Role.ADMIN, Role.CAREGIVER))` and the current user has a role outside that set
- **THEN** the response MUST be 403 with `ErrorResponse{ code: "forbidden.auth.role" }`

#### Scenario: Empty role set is a programmer error

- **WHEN** `require_role()` is called with no arguments
- **THEN** the call MUST raise `ValueError` at module load / route wiring time (not at request time)
