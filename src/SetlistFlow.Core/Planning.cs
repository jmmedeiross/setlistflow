namespace SetlistFlow.Core;

public sealed record Track(string Id, string Title, string Album, int StudioSeconds, string SourceUrl);
public sealed record SetItem(string EntryId, string TrackId, string Title, string Album, int StudioSeconds,
    int? LiveSeconds, int IntroSeconds, int PauseSeconds, string Energy, string Cue);
public sealed record Plan(string Name, int LimitSeconds, int MarginSeconds, List<SetItem> Items);
public sealed record Timing(int StudioSeconds, int PerformanceSeconds, int IntroSeconds, int PauseSeconds,
    int TotalSeconds, int UsableSeconds, int RemainingSeconds, int EstimatedCount);
public sealed record Revision(long Id, int Number, string CreatedAt, Plan Plan, Timing Timing);
public sealed record ShowView(string Id, int Version, Revision Draft, Revision? Approved, List<Revision> History);

public sealed class PlanningException(string message) : Exception(message);

public static class Planner
{
    public static Timing Calculate(Plan plan)
    {
        Validate(plan);
        var studio = plan.Items.Sum(i => i.StudioSeconds);
        var performance = plan.Items.Sum(i => i.LiveSeconds ?? i.StudioSeconds);
        var intro = plan.Items.Sum(i => i.IntroSeconds);
        var pause = plan.Items.Sum(i => i.PauseSeconds);
        var total = checked(performance + intro + pause);
        var usable = plan.LimitSeconds - plan.MarginSeconds;
        return new(studio, performance, intro, pause, total, usable, usable - total,
            plan.Items.Count(i => i.LiveSeconds is null));
    }

    public static void Validate(Plan plan)
    {
        if (string.IsNullOrWhiteSpace(plan.Name) || plan.Name.Length > 120)
            throw new PlanningException("Informe um nome de apresentação com até 120 caracteres.");
        if (plan.LimitSeconds is < 60 or > 14400)
            throw new PlanningException("O tempo do show deve ficar entre 1 e 240 minutos.");
        if (plan.MarginSeconds < 0 || plan.MarginSeconds >= plan.LimitSeconds)
            throw new PlanningException("A margem deve ser menor que o tempo do show e não pode ser negativa.");
        if (plan.Items is null || plan.Items.Count > 100)
            throw new PlanningException("Um repertório pode ter até 100 entradas.");
        var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in plan.Items)
        {
            if (item is null) throw new PlanningException("Uma entrada do repertório está vazia.");
            if (string.IsNullOrWhiteSpace(item.EntryId) || !ids.Add(item.EntryId))
                throw new PlanningException("Cada entrada do repertório precisa de um identificador único.");
            if (string.IsNullOrWhiteSpace(item.TrackId) || string.IsNullOrWhiteSpace(item.Title) || item.Title.Length > 150)
                throw new PlanningException("A entrada precisa identificar uma faixa válida.");
            if (item.StudioSeconds is < 1 or > 3600 || item.LiveSeconds is < 1 or > 3600 ||
                item.IntroSeconds is < 0 or > 600 || item.PauseSeconds is < 0 or > 600)
                throw new PlanningException("Verifique as durações: faixa de 1 a 3600 segundos; intro e pausa de 0 a 600.");
            if (item.Energy is not ("" or "baixa" or "media" or "alta"))
                throw new PlanningException("A energia deve ser baixa, média ou alta, ou ficar sem classificação.");
            if (item.Cue is null || item.Cue.Length > 500)
                throw new PlanningException("As instruções de palco devem ter até 500 caracteres.");
        }
    }

    public static void CanApprove(Plan plan)
    {
        var timing = Calculate(plan);
        if (plan.Items.Count == 0) throw new PlanningException("Adicione pelo menos uma faixa antes de aprovar.");
        if (timing.RemainingSeconds < 0) throw new PlanningException("O repertório excede o tempo utilizável. Ajuste-o antes de aprovar.");
    }
}
