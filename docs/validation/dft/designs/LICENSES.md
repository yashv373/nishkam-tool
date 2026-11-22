# Validation designs and licences

- `counter.v`: 4-bit synchronous counter from `web/studio/engines/selftest-fixtures.js` (Nishkam repository).
- `acc.v`: 3-flop accumulator with enable from `web/studio/engines/atpg.selftest.mjs` (Nishkam repository).
- `c17.bench`, `c17.v`: ISCAS'85 `c17` combinational benchmark (F. Brglez and H. Fujiwara, IEEE ISCAS 1985). Released to the EDA community as public-domain academic data (no formal open-source licence).
- `s27.v`, `s298.v`, `s344.v`: ISCAS'89 sequential benchmarks (F. Brglez, D. Bryan, and K. Kozminski, "Combinational Profiles of Sequential Benchmark Circuits", IEEE ISCAS 1989, vol. 3, pp. 1929-1934, DOI 10.1109/ISCAS.1989.100747). The original netlists carry no formal open-source licence and are public-domain academic data. The normalized synthesizable Verilog files here (logic unchanged; behavioral `dff` module and unused `GND`/`VDD` ports removed) are from `zeroasiccorp/logikbench` (MIT licence on the normalization).
