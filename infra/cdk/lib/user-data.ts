import * as ec2 from "aws-cdk-lib/aws-ec2";

export interface UserDataParams {
  readonly region: string;
  readonly ecrRegistry: string;
  readonly imageTag: string;
  readonly appHost: string;
  readonly apiHost: string;
  readonly filesHost: string;
  readonly leEmail: string;
  readonly bucketName: string;
}

const COMPOSE_VERSION = "v2.32.1";

// Boot script: install Docker + compose plugin, sync configs + secrets from S3,
// assemble the root .env (context vars + synced secrets), ECR login, pull + up.
// No build, no git clone, no creds baked — the box only pulls.
export function buildUserData(p: UserDataParams): ec2.UserData {
  const ud = ec2.UserData.forLinux();
  ud.addCommands(
    "set -euxo pipefail",
    // AL2023 ships aws cli v2; add docker + the compose plugin.
    "dnf install -y docker",
    "systemctl enable --now docker",
    "mkdir -p /usr/local/lib/docker/cli-plugins",
    `curl -SL https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose`,
    "chmod +x /usr/local/lib/docker/cli-plugins/docker-compose",
    // Pull configs + staged secrets from S3.
    "mkdir -p /opt/zas",
    `aws s3 sync s3://${p.bucketName} /opt/zas`,
    // Root .env for compose interpolation: context vars first, then secrets.
    "cat > /opt/zas/.env <<EOF",
    `ECR_REGISTRY=${p.ecrRegistry}`,
    `IMAGE_TAG=${p.imageTag}`,
    `APP_HOST=${p.appHost}`,
    `API_HOST=${p.apiHost}`,
    `FILES_HOST=${p.filesHost}`,
    `LE_EMAIL=${p.leEmail}`,
    "EOF",
    "if [ -f /opt/zas/secrets.env ]; then cat /opt/zas/secrets.env >> /opt/zas/.env; fi",
    // ECR login via the instance role.
    `aws ecr get-login-password --region ${p.region} | docker login --username AWS --password-stdin ${p.ecrRegistry}`,
    // Bring the stack up.
    "cd /opt/zas",
    "docker compose -f docker-compose.deploy.yml pull",
    "docker compose -f docker-compose.deploy.yml up -d",
  );
  return ud;
}
