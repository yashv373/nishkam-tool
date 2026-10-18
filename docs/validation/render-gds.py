# klayout -b -r render-gds.py -rd g=in.gds -rd p=out.png : draw a GDS to a PNG (default layer colours)
import pya
lv = pya.LayoutView(); lv.load_layout(g, True); lv.max_hier(); lv.zoom_fit()
lv.save_image(p, 900, 700)
