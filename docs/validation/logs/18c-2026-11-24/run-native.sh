#!/bin/bash
# Native ngspice-46 on the decks written by run18c.mjs (container gf180, image hpretl/iic-osic-tools:chipathon26).
# Usage: bash run-native.sh   (from any folder, in a bash shell on Windows). Logs go to native/<name>.log.
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")"; mkdir -p native
docker exec gf180 rm -rf /tmp/s18c; docker exec gf180 mkdir -p /tmp/s18c
docker cp decks/. gf180:/tmp/s18c/
docker exec gf180 bash -lc 'cd /tmp/s18c; ngspice -v | grep ngspice- > version.txt
printf "set ngbehavior=hsa\nset ng_nomodcheck\nset num_threads=4\nset enable_noisy_r\n" > .spiceinit
for f in *.cir; do d=${f%.cir}; mkdir -p r_$d; cp .spiceinit r_$d/
  sed -e "s#/pdk/gf180mcuD/#/foss/pdks/gf180mcuD/libs.tech/ngspice/#g" -e "s#write /#write #" $f > r_$d/deck.cir
  (cd r_$d; ngspice -b -o log deck.cir >/dev/null 2>&1; echo "$d exit $?"); cp r_$d/log $d.log; done' 2>&1 | grep -v INFO
for f in decks/*.cir; do n=$(basename $f .cir); docker cp gf180:/tmp/s18c/$n.log native/$n.log; done
docker cp gf180:/tmp/s18c/version.txt native/version.txt
