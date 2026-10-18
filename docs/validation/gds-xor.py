# klayout -b -r gds-xor.py -rd a=A.gds -rd b=B.gds -rd top=TOP : XOR of two GDS on every layer; prints "XOR <total area> ..." (0 = identical geometry)
import pya
la, lb = pya.Layout(), pya.Layout(); la.read(a); lb.read(b)
ta, tb = la.cell(top), lb.cell(top); tot = 0; n = 0
for li in la.layer_infos():
    ra = pya.Region(ta.begin_shapes_rec(la.layer(li))); k = lb.find_layer(li)
    rb = pya.Region(tb.begin_shapes_rec(k)) if k is not None else pya.Region()
    x = ra ^ rb; tot += x.area(); n += 1
    if x.area(): print("layer", li, "xor area", x.area())
print("XOR", tot, "over", n, "layers")
