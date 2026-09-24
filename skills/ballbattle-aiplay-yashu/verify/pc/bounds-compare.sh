#!/bin/sh
# 边界感知污染对照：OLD(旧门) / NEW-A(现役遮罩) / NEW-C(排行榜遮罩下延)
# bounds 越大 = 以为离墙越远；若 NEW 比 OLD 明显变大 = 白字污染了"内容最远延伸"
NODE="C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-3/node.exe"
PY="C:/Users/Administrator/.workbuddy/binaries/python/versions/3.13.12/python.exe"
HERE="$(cd "$(dirname "$0")" && pwd)"
BTNS="457,964,231;2817,541,160;2494,1203,155"
M_A="0,0,3200,200;2640,0,560,310;1700,120,270,150"
M_C="0,0,3200,200;2630,0,570,600;1700,120,270,150"
for f in phone-20260923-211925 phone-20260923-211959 screen_01 screen_02 screen_03 screen_04 screen_05 红刺和绿刺; do
  printf "%-24s" "$f"
  $NODE "$HERE/qiu-vision-replay.js" "D:/empty/_calib/argb/$f.argb" --btns "$BTNS" --project /tmp/bb-old | $PY -c "
import sys,json;d=json.load(sys.stdin);b=d.get('bounds');print(' OLD L%4s R%4s T%4s B%4s'%(b['left'],b['right'],b['top'],b['bottom']),end='')
"
  $NODE "$HERE/qiu-vision-replay.js" "D:/empty/_calib/argb/$f.argb" --btns "$BTNS" --masks "$M_A" | $PY -c "
import sys,json;d=json.load(sys.stdin);b=d.get('bounds');print(' | A L%4s R%4s T%4s B%4s'%(b['left'],b['right'],b['top'],b['bottom']),end='')
"
  $NODE "$HERE/qiu-vision-replay.js" "D:/empty/_calib/argb/$f.argb" --btns "$BTNS" --masks "$M_C" | $PY -c "
import sys,json;d=json.load(sys.stdin);b=d.get('bounds');print(' | C L%4s R%4s T%4s B%4s'%(b['left'],b['right'],b['top'],b['bottom']))
"
done
