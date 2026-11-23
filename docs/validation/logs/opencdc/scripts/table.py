import json,re
o=json.load(open('ours.json'))
def n(s):return re.sub(r'[^a-z0-9]+','_',s.lower()).strip('_')
rn={}
for l in open('out/summary.tsv',encoding='utf8'):
    p=l.rstrip('\n').split('\t')+['','']
    nm=p[0].replace('/','.')
    def sv(k):
        c={}
        for f in json.load(open(f'out/{nm}.{k}.json'))['findings']:
            r=f.get('rule_id') or f.get('rule')
            if f.get('severity') in('error','warning'):c[r]=c.get(r,0)+1
        return ' '.join(f'{a}x{b}' for a,b in sorted(c.items())) or 'none'
    rn[n(p[0])]=(sv('rtl'),sv('nl'))
print("""# OpenCDC vs Nishkam CDC grader (issue #113 phase 1)
OpenCDC 4101730f63ccd687354ad6316566c9e77b5f1f80; native Release -j8, BUILD_TESTING=ON, no changes needed; ctest 576/576 pass.
WASM skipped (scope cut).
Re-run: node scripts/ours.mjs (from Keller repo dir); docker exec gf180 bash /foss/designs/opencdc/scripts/run.sh; python scripts/table.py > RESULTS.md
Setup (v2): sync2 input d is driven via a clk_a register in a wrapper (OpenCDC cannot give an input port a clock domain: no set_input_delay or port-to-clock in SDC/YAML). Only error+warning findings count (info = verified-safe audit trail).
Setup: SDC create_clock per clock port; netlist = yosys synth + dfflegalize to $_DFF_P_ + abc + write_verilog -noexpr, cells.yaml maps $_DFF_P_.
OpenCDC "none" = no findings. agree = (ours pass) == (OpenCDC RTL none).

case | ours | OpenCDC RTL | OpenCDC netlist | agree
--|--|--|--|--""")
ag=0
for k,v in o.items():
    a,b=rn.get(n(k),('?','?'))
    y=(v['got']=='pass')==(a=='none'); ag+=y
    print(f"{k}|{v['got']}|{a}|{b}|{'yes' if y else 'no'}")
print(f"\nagree {ag}/{len(o)}\n\nNotes: with the wrapper, OpenCDC separates the sync2 variants it can see (1_flop error; 2/3 flops info) but not logic-between/bypass/inverted-output. FIFO Gray references still get CDC001/002/007 errors (wide Gray syncs: known gap); pulse toggle reference is info only. No constraint option removes the FIFO flags.")
