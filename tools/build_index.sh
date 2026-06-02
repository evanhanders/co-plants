#!/usr/bin/env bash
# Build the species->photo candidate index by streaming the two big iNat open-data
# tables once each. Outputs /tmp/imgwork/photos_keep.tsv (the candidate pool).
set -o pipefail
UA="ColoPlantsHerbarium/1.0 (https://github.com/evanhanders/co-plants; evanhanders@gmail.com)"
B="https://inaturalist-open-data.s3.amazonaws.com"
W=/tmp/imgwork
cd "$(dirname "$0")"

echo "[$(date +%T)] PASS A: observations (12GB) ..."
curl -fsS --retry 5 --retry-delay 3 --retry-all-errors -A "$UA" "$B/observations.csv.gz" \
  | zcat | python3 filter_obs.py "$W/taxonset.tsv" "$W/obs_keep.tsv" 4000
rc=$?; echo "[$(date +%T)] PASS A rc=$rc; obs_keep lines: $(wc -l < $W/obs_keep.tsv 2>/dev/null)"
[ $rc -ne 0 ] && { echo "PASS A FAILED"; exit 1; }

echo "[$(date +%T)] PASS B: photos (18GB) ..."
curl -fsS --retry 5 --retry-delay 3 --retry-all-errors -A "$UA" "$B/photos.csv.gz" \
  | zcat | python3 filter_photos.py "$W/obs_keep.tsv" "$W/photos_keep.tsv"
rc=$?; echo "[$(date +%T)] PASS B rc=$rc; photos_keep lines: $(wc -l < $W/photos_keep.tsv 2>/dev/null)"
[ $rc -ne 0 ] && { echo "PASS B FAILED"; exit 1; }
echo "[$(date +%T)] DONE."
