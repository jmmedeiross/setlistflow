using Microsoft.Data.Sqlite;
using SetlistFlow.Core;
using System.Text.Json;

namespace SetlistFlow.Api;

public sealed class ConflictException : Exception
{
}
public sealed class MissingException : Exception
{
}

public sealed class Repository
{
    private readonly string connectionString;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public Repository(string path)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path))!);
        connectionString = new SqliteConnectionStringBuilder { DataSource = path, DefaultTimeout = 10 }.ToString();
        using var db = Open();
        Run(db, null, "PRAGMA journal_mode=WAL;");
        Run(db, null, """
            CREATE TABLE IF NOT EXISTS tracks(id TEXT PRIMARY KEY, title TEXT NOT NULL, album TEXT NOT NULL, studio_seconds INTEGER NOT NULL, source_url TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
            CREATE TABLE IF NOT EXISTS shows(id TEXT PRIMARY KEY, version INTEGER NOT NULL, draft_id INTEGER, approved_id INTEGER);
            CREATE TABLE IF NOT EXISTS revisions(id INTEGER PRIMARY KEY AUTOINCREMENT, show_id TEXT NOT NULL REFERENCES shows(id), number INTEGER NOT NULL, created_at TEXT NOT NULL, plan_json TEXT NOT NULL, UNIQUE(show_id,number));
            """);
        Seed(db);
        if (Convert.ToInt64(Scalar(db, null, "SELECT COUNT(*) FROM shows")) == 0)
        {
            var catalog = Tracks().ToDictionary(t => t.Id);
            string[] order = ["leans-pt2", "flashbacks", "amiri", "safety", "viciar", "fim"];
            var items = order.Select((id, index) => { var t = catalog[id]; return new SetItem(Guid.NewGuid().ToString("N"), t.Id, t.Title, t.Album, t.StudioSeconds, null, 0, index < 5 ? 20 : 0, "", ""); }).ToList();
            var sample = Create(new("Festival · estudo de caso", 1800, 120, items));
            if (string.Equals(Environment.GetEnvironmentVariable("SETLISTFLOW_READ_ONLY"), "true", StringComparison.OrdinalIgnoreCase))
                Approve(sample.Id, sample.Version);
        }
    }
    private SqliteConnection Open()
    {
        var db = new SqliteConnection(connectionString);
        db.Open();
        Run(db, null, "PRAGMA foreign_keys=ON;");
        return db;
    }
    private static SqliteCommand Command(SqliteConnection db, SqliteTransaction? tx, string sql, params (string, object?)[] args)
    {
        var cmd = db.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = sql;
        foreach (var (name, value) in args)
            cmd.Parameters.AddWithValue(name, value ?? DBNull.Value);
        return cmd;
    }
    private static int Run(SqliteConnection db, SqliteTransaction? tx, string sql, params (string, object?)[] args)
    {
        using var cmd = Command(db, tx, sql, args);
        return cmd.ExecuteNonQuery();
    }
    private static object? Scalar(SqliteConnection db, SqliteTransaction? tx, string sql, params (string, object?)[] args)
    {
        using var cmd = Command(db, tx, sql, args);
        return cmd.ExecuteScalar();
    }
    private static void Seed(SqliteConnection db)
    {
        const string a = "https://open.spotify.com/embed/album/3VGvkH5X8bhjIV0rSohaVU";
        const string b = "https://open.spotify.com/album/5VOHcEH6D1DMngkxky552g";
        Track[] tracks = [new("leans-pt2", "Leans, Pt. 2", "237", 172, a), new("flashbacks", "Flashbacks", "237", 164, a), new("fim", "Fim", "237", 184, a), new("amiri", "Amiri", "MR.", 166, b), new("safety", "Safety", "MR.", 157, b), new("viciar", "Viciar", "MR.", 195, b)];
        using var tx = db.BeginTransaction();
        foreach (var t in tracks)
            Run(db, tx, "INSERT OR IGNORE INTO tracks(id,title,album,studio_seconds,source_url) VALUES($id,$title,$album,$seconds,$url)", ("$id", t.Id), ("$title", t.Title), ("$album", t.Album), ("$seconds", t.StudioSeconds), ("$url", t.SourceUrl));
        tx.Commit();
    }
    public List<Track> Tracks()
    {
        using var db = Open();
        using var cmd = Command(db, null, "SELECT id,title,album,studio_seconds,source_url FROM tracks WHERE active=1 ORDER BY album,title");
        using var reader = cmd.ExecuteReader();
        var list = new List<Track>();
        while (reader.Read())
            list.Add(new(reader.GetString(0), reader.GetString(1), reader.GetString(2), reader.GetInt32(3), reader.GetString(4)));
        return list;
    }
    public Track CreateTrack(string? title, string? album, int seconds, string? url)
    {
        album ??= "";
        url ??= "";
        if (string.IsNullOrWhiteSpace(title) || title.Length > 150 || album.Length > 100 || seconds is < 1 or > 3600)
            throw new PlanningException("Informe título, álbum (até 100 caracteres) e uma duração entre 1 e 3600 segundos.");
        if (url.Length > 500 || (!string.IsNullOrEmpty(url) && (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != "https")))
            throw new PlanningException("A fonte deve ser um endereço HTTPS ou ficar vazia.");
        var t = new Track(Guid.NewGuid().ToString("N"), title.Trim(), album.Trim(), seconds, url);
        using var db = Open();
        Run(db, null, "INSERT INTO tracks(id,title,album,studio_seconds,source_url) VALUES($id,$t,$a,$s,$u)", ("$id", t.Id), ("$t", t.Title), ("$a", t.Album), ("$s", t.StudioSeconds), ("$u", t.SourceUrl));
        return t;
    }
    public void DeleteTrack(string id)
    {
        using var db = Open();
        if (Run(db, null, "UPDATE tracks SET active=0 WHERE id=$id AND active=1", ("$id", id)) == 0)
            throw new MissingException();
    }
    public List<ShowView> Shows()
    {
        using var db = Open();
        using var tx = db.BeginTransaction();
        using var cmd = Command(db, tx, "SELECT id FROM shows ORDER BY rowid DESC");
        using var reader = cmd.ExecuteReader();
        var ids = new List<string>();
        while (reader.Read())
            ids.Add(reader.GetString(0));
        reader.Close();
        var result = ids.Select(id => Read(db, tx, id)).ToList();
        tx.Commit();
        return result;
    }
    public ShowView Get(string id)
    {
        using var db = Open();
        using var tx = db.BeginTransaction();
        var view = Read(db, tx, id);
        tx.Commit();
        return view;
    }
    private static ShowView Read(SqliteConnection db, SqliteTransaction tx, string id)
    {
        using var cmd = Command(db, tx, "SELECT version,draft_id,approved_id FROM shows WHERE id=$id", ("$id", id));
        using var r = cmd.ExecuteReader();
        if (!r.Read())
            throw new MissingException();
        var version = r.GetInt32(0);
        var draft = r.GetInt64(1);
        long? approved = r.IsDBNull(2) ? null : r.GetInt64(2);
        r.Close();
        using var rc = Command(db, tx, "SELECT id,number,created_at,plan_json FROM revisions WHERE show_id=$id ORDER BY number DESC", ("$id", id));
        using var rr = rc.ExecuteReader();
        var revisions = new List<Revision>();
        while (rr.Read())
        {
            var plan = JsonSerializer.Deserialize<Plan>(rr.GetString(3), Json)!;
            revisions.Add(new(rr.GetInt64(0), rr.GetInt32(1), rr.GetString(2), plan, Planner.Calculate(plan)));
        }
        return new(id, version, revisions.Single(x => x.Id == draft), approved is null ? null : revisions.Single(x => x.Id == approved), revisions);
    }
    private static long InsertRevision(SqliteConnection db, SqliteTransaction tx, string id, int number, Plan plan)
    {
        Run(db, tx, "INSERT INTO revisions(show_id,number,created_at,plan_json) VALUES($id,$n,$at,$p)", ("$id", id), ("$n", number), ("$at", DateTimeOffset.UtcNow.ToString("O")), ("$p", JsonSerializer.Serialize(plan, Json)));
        return Convert.ToInt64(Scalar(db, tx, "SELECT last_insert_rowid()"));
    }
    private static Plan Normalize(SqliteConnection db, SqliteTransaction tx, Plan input)
    {
        Planner.Validate(input);
        var items = new List<SetItem>();
        foreach (var i in input.Items)
        {
            using var cmd = Command(db, tx, "SELECT title,album,studio_seconds FROM tracks WHERE id=$id AND active=1", ("$id", i.TrackId));
            using var r = cmd.ExecuteReader();
            if (!r.Read())
                throw new PlanningException("Uma faixa não está mais disponível no catálogo. Remova-a do rascunho.");
            items.Add(i with
            {
                Title = r.GetString(0),
                Album = r.GetString(1),
                StudioSeconds = r.GetInt32(2),
                Cue = i.Cue.Trim()
            });
        }
        return input with
        {
            Name = input.Name.Trim(),
            Items = items
        };
    }
    public ShowView Create(Plan input)
    {
        using var db = Open();
        using var tx = db.BeginTransaction(deferred: false);
        var p = Normalize(db, tx, input);
        var id = Guid.NewGuid().ToString("N");
        Run(db, tx, "INSERT INTO shows(id,version) VALUES($id,1)", ("$id", id));
        var rev = InsertRevision(db, tx, id, 1, p);
        Run(db, tx, "UPDATE shows SET draft_id=$r WHERE id=$id", ("$r", rev), ("$id", id));
        tx.Commit();
        return Get(id);
    }
    public ShowView Save(string id, int expectedVersion, Plan input)
    {
        using var db = Open();
        using var tx = db.BeginTransaction(deferred: false);
        var old = Read(db, tx, id);
        if (old.Version != expectedVersion)
            throw new ConflictException();
        var plan = Normalize(db, tx, input);
        var rev = InsertRevision(db, tx, id, old.History.Max(x => x.Number) + 1, plan);
        if (Run(db, tx, "UPDATE shows SET version=version+1,draft_id=$r WHERE id=$id AND version=$v", ("$r", rev), ("$id", id), ("$v", expectedVersion)) != 1)
            throw new ConflictException();
        tx.Commit();
        return Get(id);
    }
    public ShowView Approve(string id, int expectedVersion)
    {
        using var db = Open();
        using var tx = db.BeginTransaction(deferred: false);
        var old = Read(db, tx, id);
        if (old.Version != expectedVersion)
            throw new ConflictException();
        Planner.CanApprove(old.Draft.Plan);
        if (Run(db, tx, "UPDATE shows SET version=version+1,approved_id=draft_id WHERE id=$id AND version=$v", ("$id", id), ("$v", expectedVersion)) != 1)
            throw new ConflictException();
        tx.Commit();
        return Get(id);
    }
}
