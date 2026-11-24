# klayout -b -r count-shapes.py -rd gds=<file.gds>
# Counts shapes of the top cell, recursively through all instances (arrays expanded), per GDS layer/datatype.
# Text labels are counted separately from drawn shapes (polygons, boxes, paths).
import pya, collections
ly = pya.Layout()
ly.read(gds)
top = ly.top_cells()
print("klayout", pya.Application.instance().version())
print("top cells:", [t.name for t in top], "dbu:", ly.dbu)
t = top[0]
print("different cell types called from top:", len({ly.cell(c).name for c in t.called_cells()}))
for li in ly.layer_indexes():
    info = ly.get_info(li)
    n = collections.Counter()
    it = t.begin_shapes_rec(li)
    while not it.at_end():
        n["text" if it.shape().is_text() else "shape"] += 1
        it.next()
    if n:
        print(f"LAYER {info.layer}/{info.datatype} shapes={n['shape']} texts={n['text']}")
