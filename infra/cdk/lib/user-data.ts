import * as ec2 from "aws-cdk-lib/aws-ec2";

export interface UserDataParams {
  readonly region: string;
  readonly ecrRegistry: string;
  readonly appHost: string;
  readonly apiHost: string;
  readonly filesHost: string;
  readonly leEmail: string;
  readonly bucketName: string;
}

const COMPOSE_VERSION = "v2.32.1";

// Boot script: install Docker, mount the retained data volume as Docker's
// data-root (so all named volumes persist across instance replacement), sync
// configs + secrets from S3, assemble the root .env, ECR login, pull + up.
// The image tag is NOT baked in here — it comes from the S3-synced tag.env, so
// tag rollouts never change UserData (and so never replace the instance).
export function buildUserData(p: UserDataParams): ec2.UserData {
  const ud = ec2.UserData.forLinux();
  ud.addCommands(
    "set -euxo pipefail",
    // AL2023 ships aws cli v2; add docker + the compose plugin.
    "dnf install -y docker",
    "mkdir -p /usr/local/lib/docker/cli-plugins",
    `curl -SL https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose`,
    "chmod +x /usr/local/lib/docker/cli-plugins/docker-compose",

    // --- Persistent data volume: format-if-empty, mount, Docker data-root. ---
    // Runs in its own shell (set -u, no -e) so device-probe loops can't trip the
    // outer pipefail. AL2023 (amazon-ec2-utils) creates the /dev/sdf symlink for
    // the attached EBS NVMe device; fall back to the lone non-root disk.
    "cat > /usr/local/bin/zas-mount-data.sh <<'EOS'",
    "#!/bin/bash",
    "set -uo pipefail",
    "dev=''",
    "root_disk=$(lsblk -ndo PKNAME \"$(findmnt -no SOURCE /)\")",
    "for i in $(seq 1 60); do",
    "  if [ -e /dev/sdf ]; then dev=/dev/sdf; break; fi",
    "  for name in $(lsblk -dn -o NAME); do",
    "    cand=\"/dev/$name\"",
    "    if [ \"$name\" = \"$root_disk\" ]; then continue; fi",
    "    if [ \"$(lsblk -dno TYPE \"$cand\")\" != disk ]; then continue; fi",
    "    if [ -z \"$(lsblk -no MOUNTPOINT \"$cand\" | tr -d ' \\n')\" ]; then dev=\"$cand\"; fi",
    "  done",
    "  if [ -n \"$dev\" ]; then break; fi",
    "  sleep 2",
    "done",
    "if [ -z \"$dev\" ]; then echo 'data volume never attached' >&2; exit 1; fi",
    "if ! blkid \"$dev\" >/dev/null 2>&1; then mkfs.ext4 -L zasdata \"$dev\"; fi",
    "mkdir -p /mnt/zasdata",
    "if ! grep -q '^LABEL=zasdata' /etc/fstab; then echo 'LABEL=zasdata /mnt/zasdata ext4 defaults,nofail 0 2' >> /etc/fstab; fi",
    "mount -a",
    "mkdir -p /mnt/zasdata/docker",
    "EOS",
    "chmod +x /usr/local/bin/zas-mount-data.sh",
    "/usr/local/bin/zas-mount-data.sh",

    // Point Docker at the persistent volume BEFORE first start, so every named
    // volume (Postgres, MinIO, Let's Encrypt) lands on the retained disk.
    "mkdir -p /etc/docker",
    'printf \'{\\n  "data-root": "/mnt/zasdata/docker"\\n}\\n\' > /etc/docker/daemon.json',
    "systemctl enable --now docker",

    // Pull configs + staged secrets + tag.env from S3.
    "mkdir -p /opt/zas",
    `aws s3 sync s3://${p.bucketName} /opt/zas`,
    // Root .env for compose interpolation: static context, then tag, then secrets.
    "cat > /opt/zas/.env <<EOF",
    `ECR_REGISTRY=${p.ecrRegistry}`,
    `APP_HOST=${p.appHost}`,
    `API_HOST=${p.apiHost}`,
    `FILES_HOST=${p.filesHost}`,
    `LE_EMAIL=${p.leEmail}`,
    "EOF",
    "if [ -f /opt/zas/tag.env ]; then cat /opt/zas/tag.env >> /opt/zas/.env; else echo IMAGE_TAG=latest >> /opt/zas/.env; fi",
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
