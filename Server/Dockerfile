# Backend Dockerfile для ASP.NET 9
# Размещение: Server/Dockerfile

# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Копируем csproj и восстанавливаем зависимости
COPY ["DroneMonitoring.Server.csproj", "./"]
RUN dotnet restore "DroneMonitoring.Server.csproj"

# Копируем все файлы и собираем
COPY . .
RUN dotnet build "DroneMonitoring.Server.csproj" -c Release -o /app/build

# Stage 2: Publish
FROM build AS publish
RUN dotnet publish "DroneMonitoring.Server.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 3: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app

# Устанавливаем переменные окружения
ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Production

# Копируем собранное приложение
COPY --from=publish /app/publish .

# Открываем порт
EXPOSE 5000

# Запускаем приложение
ENTRYPOINT ["dotnet", "DroneMonitoring.Server.dll"]
