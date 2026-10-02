# 1) Derleme: JAR Docker içinde üretilir, bilgisayarda Java kurulu olması gerekmez.
#    Bağımlılıklar ayrı katmanda indirilir; yalnızca kod değişince yeniden indirilmez.
FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY gradlew settings.gradle build.gradle ./
COPY gradle gradle
RUN chmod +x gradlew && ./gradlew --no-daemon -q dependencies > /dev/null
COPY src src
RUN ./gradlew --no-daemon -q bootJar -x test

# 2) Çalıştırma: yalnızca JRE ve JAR
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /src/build/libs/*-SNAPSHOT.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
