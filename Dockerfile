# ---- build ----
# The Gradle wrapper jar is not bundled in this project, so the image installs Gradle directly.
FROM eclipse-temurin:25-jdk AS build
ARG GRADLE_VERSION=9.6.0
WORKDIR /workspace
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl unzip \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL "https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip" -o /tmp/gradle.zip \
 && unzip -q /tmp/gradle.zip -d /opt \
 && rm /tmp/gradle.zip
ENV PATH=/opt/gradle-${GRADLE_VERSION}/bin:${PATH}
COPY settings.gradle build.gradle ./
COPY src src
RUN gradle --no-daemon bootJar

# ---- run ----
FROM eclipse-temurin:25-jre
WORKDIR /app
ENV TZ=Asia/Kolkata
COPY --from=build /workspace/build/libs/app.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
