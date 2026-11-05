@echo off
setlocal
set "APP_HOME=%~dp0"
set "JAR=%APP_HOME%gradle\wrapper\gradle-wrapper.jar"
if exist "%JAR%" goto runjar

set "VERSION=9.6.0"
set "BASE=%USERPROFILE%\.gradle\vms-bootstrap"
set "GRADLE_BAT=%BASE%\gradle-%VERSION%\bin\gradle.bat"
if exist "%GRADLE_BAT%" goto rungradle

echo Downloading Gradle %VERSION% ...
if not exist "%BASE%" mkdir "%BASE%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing 'https://services.gradle.org/distributions/gradle-%VERSION%-bin.zip' -OutFile '%BASE%\gradle.zip'; Expand-Archive -Force '%BASE%\gradle.zip' '%BASE%'; Remove-Item '%BASE%\gradle.zip'"
if errorlevel 1 exit /b 1

:rungradle
call "%GRADLE_BAT%" %*
exit /b %ERRORLEVEL%

:runjar
java -classpath "%JAR%" org.gradle.wrapper.GradleWrapperMain %*
exit /b %ERRORLEVEL%
