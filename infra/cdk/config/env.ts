// Central config for the ephemeral AWS demo. Account/region resolve from the
// active SSO session (CDK_DEFAULT_*); region pinned to eu-west-1 (EU data
// residency). fromLookup (VPC, HostedZone) needs an explicit env, so this is
// required, not env-agnostic.

export const cdkEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "eu-west-1",
};

export const config = {
  hostedZone: "zas.lebba.nl",
  appHost: "app.zas.lebba.nl",
  apiHost: "api.zas.lebba.nl",
  leEmail: "levi.bravenboer@reaktor.com",
  instanceType: "t3.large",
  volumeSizeGb: 30,
  backendRepo: "zas-backend",
  orchestratorRepo: "zas-orchestrator",
  // SG source for 80/443. Lock to a CIDR via `-c allowedCidr=1.2.3.4/32`;
  // defaults to world-open for the throwaway week.
  defaultAllowedCidr: "0.0.0.0/0",
  tags: { project: "zas", env: "demo", ephemeral: "true" },
} as const;
