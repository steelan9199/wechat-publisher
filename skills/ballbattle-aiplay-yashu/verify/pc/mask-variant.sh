#!/bin/sh
# 右上遮罩变体对照：看排行榜区是否还有"球"（真球 vs 文字幻影）
NODE="C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-3/node.exe"
PY="C:/Users/Administrator/.workbuddy/binaries/python/versions/3.13.12/python.exe"
HERE="$(cd "$(dirname "$0")" && pwd)"
BTNS="457,964,231;2817,541,160;2494,1203,155"
M_A="0,0,3200,200;2640,0,560,310;1700,120,270,150"
M_B="0,0,3200,200;2640,0,560,520;1700,120,270,150"
M_C="0,0,3200,200;2630,0,570,560;1700,120,270,150"
IMG="screen_01 screen_02 红刺和绿刺 screen_03"
for v in A B C; do
  eval "M=\$M_$v"
  echo "=== 变体$v  $M"
  for f in $IMG; do
    $NODE "$HERE/qiu-vision-replay.js" "D:/empty/_calib/argb/$f.argb" --btns "$BTNS" --masks "$M" | $PY -c "
import sys,json
d=json.load(sys.stdin)
xs=[b for b in d['balls'] if b['x']>2300 and b['y']<760]
print('   %-12s 右上区球数=%d  %s' % ('$f', len(xs), [(b['x'], b['y'], b['r']) for b in xs]))
"
  done
done
