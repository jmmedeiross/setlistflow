using SetlistFlow.Api;
using SetlistFlow.Core;

SQLitePCL.Batteries_V2.Init();
var builder = WebApplication.CreateBuilder(args);
if (int.TryParse(Environment.GetEnvironmentVariable("PORT"), out var platformPort) && platformPort is > 0 and < 65536)
    builder.WebHost.UseUrls($"http://0.0.0.0:{platformPort}");
var dbPath = Environment.GetEnvironmentVariable("SETLISTFLOW_DB") ?? Path.Combine(builder.Environment.ContentRootPath, "data", "setlistflow.db");
builder.Services.AddSingleton(new Repository(dbPath));
var app = builder.Build();
var readOnly = string.Equals(Environment.GetEnvironmentVariable("SETLISTFLOW_READ_ONLY"), "true", StringComparison.OrdinalIgnoreCase);
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    ctx.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    ctx.Response.Headers["Content-Security-Policy"] = "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
    if (ctx.Request.Path.StartsWithSegments("/api"))
        ctx.Response.Headers.CacheControl = "no-store";
    if (readOnly && ctx.Request.Path.StartsWithSegments("/api") && ctx.Request.Method != "GET")
    {
        ctx.Response.StatusCode = 403;
        await ctx.Response.WriteAsJsonAsync(new
        {
            error = "Esta demonstração pública está disponível apenas para consulta."
        });
        return;
    }
    if (ctx.Request.ContentLength > 1000000)
    {
        ctx.Response.StatusCode = 413;
        await ctx.Response.WriteAsJsonAsync(new
        {
            error = "O repertório enviado excede o tamanho permitido."
        });
        return;
    }
    try
    {
        await next();
    }
    catch (PlanningException e) { ctx.Response.StatusCode = 400; await ctx.Response.WriteAsJsonAsync(new { error = e.Message }); }
    catch (ConflictException) { ctx.Response.StatusCode = 409; await ctx.Response.WriteAsJsonAsync(new { error = "Outra alteração foi salva antes da sua. Seu rascunho permanece na tela; recarregue para revisar a versão atual." }); }
    catch (MissingException) { ctx.Response.StatusCode = 404; await ctx.Response.WriteAsJsonAsync(new { error = "Apresentação ou faixa não encontrada." }); }
});
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapGet("/api/health", () => Results.Ok(new { ok = true }));
app.MapGet("/api/config", () => new { readOnly });
app.MapGet("/api/tracks", (Repository db) => db.Tracks());
app.MapPost("/api/tracks", (TrackInput input, Repository db) => Results.Created("/api/tracks", db.CreateTrack(input.Title, input.Album, input.StudioSeconds, input.SourceUrl)));
app.MapDelete("/api/tracks/{id}", (string id, Repository db) => { db.DeleteTrack(id); return Results.NoContent(); });
app.MapGet("/api/shows", (Repository db) => db.Shows());
app.MapGet("/api/shows/{id}", (string id, Repository db) => db.Get(id));
app.MapPost("/api/shows", (Plan plan, Repository db) => { var s = db.Create(plan); return Results.Created($"/api/shows/{s.Id}", s); });
app.MapPut("/api/shows/{id}", (string id, SaveInput input, Repository db) => db.Save(id, input.ExpectedVersion, input.Plan));
app.MapPost("/api/shows/{id}/approve", (string id, ApproveInput input, Repository db) => db.Approve(id, input.ExpectedVersion));
app.MapPost("/api/calculate", (Plan plan) => Planner.Calculate(plan));
app.Run();
record TrackInput(string Title, string Album, int StudioSeconds, string SourceUrl);
record SaveInput(int ExpectedVersion, Plan Plan);
record ApproveInput(int ExpectedVersion);
