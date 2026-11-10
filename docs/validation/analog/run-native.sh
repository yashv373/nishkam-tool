#!/bin/bash
# Runs all analog decks in the gf180 container; results go to native/. Needs Docker + container gf180.
set -e
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")"
W=/foss/designs/analog_ref
docker exec gf180 bash -lc "rm -rf $W/run && mkdir -p $W/run"
docker cp decks/. gf180:$W/run/
docker exec gf180 bash -lc "cd $W/run && ngspice -v | grep ngspice- > version.txt; for d in nmos_idvg pmos_idvg mirror ota5t_ac inv_tran; do ngspice -b -o \$d.log \$d.cir || exit 1; done"
mkdir -p native
for f in nmos_idvg pmos_idvg mirror ota5t_ac inv_tran; do
  docker cp gf180:$W/run/$f.raw native/$f.raw
  docker cp gf180:$W/run/$f.log native/$f.log
done
docker cp gf180:$W/run/version.txt native/version.txt
