#!/bin/sh
# Starts the backend (Spring Boot) for local development. Needs Java 25 and PostgreSQL on localhost:5432.
cd "$(dirname "$0")/backend" || exit 1
if [ -f gradle/wrapper/gradle-wrapper.jar ]; then
  exec ./gradlew bootRun
fi
echo "gradle-wrapper.jar is missing - using the installed gradle command instead."
echo "(To create the wrapper once: gradle wrapper --gradle-version 9.6.0)"
exec gradle bootRun
