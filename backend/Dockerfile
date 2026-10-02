# Task 24: the Spring Boot API as a container image.
# Two stages: build the jar with the JDK, then run it on a slim JRE image.

# ---- build ----
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app

# Dependencies first, so editing source doesn't re-download them.
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -ntp dependency:go-offline

COPY src src
# Tests run in CI (and locally); the image build only packages.
RUN ./mvnw -B -ntp -DskipTests package

# ---- run ----
FROM eclipse-temurin:21-jre
WORKDIR /app

# curl is only for the health check below.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 10001 --no-create-home closet

COPY --from=build /app/target/closetapp-*.jar app.jar

# The production profile (application-prod.properties): quiet logs, real email
# only. It replaces the dev default (profile "local"), so no local secrets file
# is ever read. Everything secret comes from environment variables - see
# DEPLOYMENT.md for the full list; the app refuses to start without DB_PASSWORD
# and JWT_SECRET.
ENV SPRING_PROFILES_ACTIVE=prod \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70"

USER closet
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
