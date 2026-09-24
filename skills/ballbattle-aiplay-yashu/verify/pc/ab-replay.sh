#!/bin/sh
# A/B 对照：旧版(git HEAD) vs 新版(工作区) 用真代码离线重放同一份像素
# 用法: sh ab-replay.sh <图名> [--all]
NODE="C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-3/node.exe"
PY="C:/Users/Administrator/.workbuddy/binaries/python/versions/3.13.12/python.exe"
BTNS="457,964,231;2817,541,160;2494,1203,155"
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"
names="$1"
[ "$1" = "--all" ] && names="phone-20260923-211925 phone-20260923-211959 screen_01 screen_02 screen_03 screen_04 screen_05 红刺和绿刺"
for img in $names; do
  echo "########## $img"
  for tag in OLD:/tmp/bb-old NEW:.; do
    lbl=${tag%%:*}; proj=${tag#*:}
    if [ "$proj" = "." ]; then P=""; else P="--project $proj"; fi
    echo "--- $lbl"
    $NODE "$HERE/qiu-vision-replay.js" "D:/empty/_calib/argb/$img.argb" --btns "$BTNS" $P --verbose | $PY -c "
import sys,json
d=json.load(sys.stdin)
for b in d['balls']:
    print('   (%4d,%4d) r=%-4d ratio=%-5s skin=%s bbox=%s' % (b['x'],b['y'],b['r'],b['ratio'],b['skin'],b['bbox']))
print('   self=%s' % json.dumps(d['self'],ensure_ascii=False))
"
  done
done
