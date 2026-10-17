#!/usr/bin/env bash
set -euo pipefail
APK=$(find android/app/build/outputs/apk/standard/debug -name '*.apk' | head -1)
adb install -r "$APK"
adb logcat -c
adb shell am start -n app.still.next/.MainActivity
for attempt in $(seq 1 30); do
  if adb shell pidof app.still.next >/dev/null; then
    adb shell uiautomator dump /sdcard/still-ui.xml >/dev/null 2>&1 || true
    if adb shell cat /sdcard/still-ui.xml | grep -Eq 'Inbox|Today|Projects'; then break; fi
  fi
  sleep 1
done
mkdir -p verification
adb shell pidof app.still.next > verification/android-pid.txt
adb logcat -d > verification/android-logcat.txt
adb shell uiautomator dump /sdcard/still-ui.xml
adb pull /sdcard/still-ui.xml verification/android-ui.xml
adb shell screencap -p /sdcard/still.png
adb pull /sdcard/still.png verification/android-installed.png
if grep -A12 'FATAL EXCEPTION' verification/android-logcat.txt | grep -q 'app.still.next'; then
  echo 'Still crashed on Android'; exit 1
fi
grep -Eq 'Inbox|Today|Projects' verification/android-ui.xml
echo 'PASS Android APK installs, launches and exposes the application UI'
