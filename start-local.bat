@echo off
REM Starts the backend (Spring Boot) for local development. Needs Java 25 and PostgreSQL on localhost:5432.
cd /d "%~dp0backend"
if exist gradle\wrapper\gradle-wrapper.jar (
  call gradlew.bat bootRun
) else (
  echo gradle-wrapper.jar is missing - using the installed gradle command instead.
  call gradle bootRun
)
