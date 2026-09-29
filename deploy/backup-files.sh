#!/usr/bin/env bash
# Copies the file side of the data directory to the backup bucket with rclone. Run through
# `op run` (docent-files-backup.service) so the LITESTREAM_* credentials arrive as env vars
# and never appear in argv or a config file. `copy`, not `sync`: a file deleted on the host
# stays in the bucket until someone removes it deliberately.
set -euo pipefail

: "${LITESTREAM_ACCESS_KEY_ID:?}" "${LITESTREAM_SECRET_ACCESS_KEY:?}" "${LITESTREAM_BUCKET:?}"
: "${LITESTREAM_ENDPOINT:?}" "${LITESTREAM_PATH:?}"
DATA_DIR="${DOCENT_DATA_DIR:-/var/lib/docent/data}"

export RCLONE_CONFIG_BACKUP_TYPE=s3
export RCLONE_CONFIG_BACKUP_PROVIDER=Other
export RCLONE_CONFIG_BACKUP_ACCESS_KEY_ID="$LITESTREAM_ACCESS_KEY_ID"
export RCLONE_CONFIG_BACKUP_SECRET_ACCESS_KEY="$LITESTREAM_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_BACKUP_ENDPOINT="$LITESTREAM_ENDPOINT"
export RCLONE_CONFIG_BACKUP_REGION="${LITESTREAM_REGION:-us-east-1}"

for dir in recordings attachments invoices; do
  [ -d "$DATA_DIR/$dir" ] || continue
  rclone copy "$DATA_DIR/$dir" "backup:$LITESTREAM_BUCKET/$LITESTREAM_PATH/files/$dir" \
    --checksum --transfers 4 --log-level NOTICE
done
