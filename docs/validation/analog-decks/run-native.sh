#!/bin/bash
# Runs page/*.cir (made by make-page-decks.mjs) with native ngspice-46 in the iic-osic-tools image; logs and raw files go to native/.
# The container gf180 would not start on 2026-11-21 (host port 8080 busy), so a throw-away container of the same image is used (docker run --rm, no ports).
set -eo pipefail
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")"
mkdir -p native && rm -f native/*
docker run --rm --entrypoint bash -v "$PWD/page:/in:ro" -v "$PWD/native:/out" hpretl/iic-osic-tools:chipathon26 -lc 'set -e; bad=0
mkdir -p /tmp/r && cd /tmp/r && cp /in/*.cir .
printf "set ngbehavior=hsa\nset ng_nomodcheck\nset num_threads=4\nset enable_noisy_r\n" > .spiceinit
ngspice -v | grep ngspice- > /out/version.txt
for f in *.cir; do d=${f%.cir}; mkdir -p $d; cp .spiceinit $d/; sed "s#write /#write #" $f > $d/deck.cir
  ( cd $d; for i in 1 2 3; do rm -f op.raw out.raw; s=$(date +%s%N); ngspice -b -o log deck.cir >/dev/null 2>&1 || echo FAIL >> fail; e=$(date +%s%N); echo $d $(( (e-s)/1000000 )) >> /out/times.txt; done )
  cp $d/log /out/$d.log; for r in op out; do if [ -f $d/$r.raw ]; then cp $d/$r.raw /out/$d.$r.raw; fi; done   # log copied even when the run failed
  if [ -f $d/fail ]; then echo FAIL $d; bad=1; fi; done
exit $bad' 2>&1 | { grep -v INFO || true; }
