## REMOVED Requirements

### Requirement: SMART launch route parses query

**Reason**: PoC scope (`openspec/scope.md`) excludes HiX SMART-on-FHIR launch from PoC. Code that isn't wired and isn't exercised rots — `[mvp]` will re-author the launch flow against the real HiX endpoint.

**Migration**: Delete `apps/orchestrator/src/routes/launch.tsx` and the `modules/smart-launch/` package. The `[mvp]` `hix-smart-launch` change re-introduces this route against a live HiX endpoint and FHIR R4 context.

### Requirement: useLaunchContext hook

**Reason**: Hook depended on the launch route and the `LaunchContext` store. Both are out of PoC scope.

**Migration**: Delete the hook + its store. `[mvp]` re-introduces a launch-context hook from `modules/hix-launch/` once the FHIR launch contract lands.

### Requirement: exchangeAuthCode signature reserved

**Reason**: Reserved signature served a future SMART change; with the SMART launch removed from PoC the stub serves no purpose and triggers dead-code lint warnings.

**Migration**: Delete the function. `[mvp]` `hix-smart-launch` re-introduces the signature against real auth-code exchange.

### Requirement: Redirect to placeholder after parsing

**Reason**: Redirect was only reachable from `/launch`, which is being removed.

**Migration**: Delete `LAUNCH_LANDING_PATH` and the redirect logic. Auth becomes the only entry point: `/login` → `/`.
