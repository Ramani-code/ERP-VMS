#!/bin/sh
# Gradle wrapper launcher (Gradle 9.6.0).
# Uses gradle/wrapper/gradle-wrapper.jar when present; otherwise downloads the
# Gradle 9.6.0 distribution once into ~/.gradle/vms-bootstrap and runs it.
APP_HOME=$(cd "$(dirname "$0")" && pwd -P)
JAR="$APP_HOME/gradle/wrapper/gradle-wrapper.jar"

if [ -f "$JAR" ]; then
  exec java -classpath "$JAR" org.gradle.wrapper.GradleWrapperMain "$@"
fi

VERSION=9.6.0
URL="https://services.gradle.org/distributions/gradle-$VERSION-bin.zip"
BASE="${GRADLE_USER_HOME:-$HOME/.gradle}/vms-bootstrap"
GRADLE_BIN="$BASE/gradle-$VERSION/bin/gradle"

if [ ! -x "$GRADLE_BIN" ]; then
  echo "Downloading Gradle $VERSION ..."
  mkdir -p "$BASE" || exit 1
  ZIP="$BASE/gradle-$VERSION-bin.zip"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$URL" -o "$ZIP" || exit 1
  elif command -v wget >/dev/null 2>&1; then
    wget -q "$URL" -O "$ZIP" || exit 1
  else
    echo "curl or wget is required to download Gradle." >&2
    exit 1
  fi
  if command -v unzip >/dev/null 2>&1; then
    (cd "$BASE" && unzip -q -o "$ZIP") || exit 1
  else
    (cd "$BASE" && jar xf "$ZIP") || exit 1
  fi
  chmod +x "$GRADLE_BIN"
  rm -f "$ZIP"
fi

exec "$GRADLE_BIN" "$@"
