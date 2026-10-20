cd /foss/designs/grader_val
for d in c*; do cd $d
 if /foss/tools/bin/yosys -q -s prove.ys >prove.log 2>&1; then r=proven
 elif /foss/tools/bin/yosys -q -s bound.ys >bound.log 2>&1; then r=bounded
 else r=fail; fi
 echo "$d $r"; cd ..
done
