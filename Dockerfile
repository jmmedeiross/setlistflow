FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY src/ ./src/
RUN dotnet publish src/SetlistFlow.Api/SetlistFlow.Api.csproj -c Release -o /app
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/ .
RUN mkdir /data && chown app:app /data
USER app
ENV ASPNETCORE_URLS=http://+:8080 SETLISTFLOW_DB=/data/setlistflow.db
EXPOSE 8080
ENTRYPOINT ["dotnet","SetlistFlow.Api.dll"]
