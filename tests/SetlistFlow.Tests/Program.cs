using SetlistFlow.Core;
var tests = new List<(string, Action)>();
SetItem Item(int seconds = 172) => new(Guid.NewGuid().ToString(), "track", "Faixa", "Projeto", seconds, null, 0, 0, "", "");
Plan Plan(List<SetItem>? items = null, int limit = 1200, int margin = 120) => new("Festival simulado", limit, margin, items ?? [Item()]);
void Test(string name, Action test) => tests.Add((name, test));
void Equal<T>(T expected, T actual) { if (!EqualityComparer<T>.Default.Equals(expected, actual)) throw new Exception($"Expected {expected}; got {actual}"); }
void Invalid(Action call) { try { call(); } catch (PlanningException) { return; } throw new Exception("Expected validation failure"); }
Test("sample sums 17:18 and five pauses produce 18:58", () =>
{
    var items = new[] { 172, 164, 184, 166, 157, 195 }.Select((s, i) => Item(s) with { PauseSeconds = i < 5 ? 20 : 0 }).ToList();
    var t = Planner.Calculate(Plan(items));
    Equal(1038, t.PerformanceSeconds);
    Equal(1138, t.TotalSeconds);
    Equal(-58, t.RemainingSeconds);
    Equal(6, t.EstimatedCount);
});
Test("over-budget approval rejected", () => Invalid(() => Planner.CanApprove(Plan([Item(1100)]))));
Test("exact usable limit can be approved", () => { Planner.CanApprove(Plan([Item(1080)])); Equal(0, Planner.Calculate(Plan([Item(1080)])).RemainingSeconds); });
Test("live duration overrides recording", () => { var t = Planner.Calculate(Plan([Item() with { LiveSeconds = 100 }])); Equal(100, t.PerformanceSeconds); Equal(0, t.EstimatedCount); Equal(172, t.StudioSeconds); });
Test("intros and final pause are counted", () => Equal(202, Planner.Calculate(Plan([Item() with { IntroSeconds = 10, PauseSeconds = 20 }])).TotalSeconds));
Test("reorder keeps total", () => { var items = new List<SetItem> { Item(200), Item(90) }; Equal(Planner.Calculate(Plan(items)).TotalSeconds, Planner.Calculate(Plan(items.AsEnumerable().Reverse().ToList())).TotalSeconds); });
Test("empty set cannot be approved", () => Invalid(() => Planner.CanApprove(Plan([]))));
Test("negative and zero live durations rejected", () => { Invalid(() => Planner.Calculate(Plan([Item() with { LiveSeconds = -1 }]))); Invalid(() => Planner.Calculate(Plan([Item() with { LiveSeconds = 0 }]))); });
Test("negative pause rejected", () => Invalid(() => Planner.Calculate(Plan([Item() with { PauseSeconds = -1 }]))));
Test("margin equal or larger than limit rejected", () => { Invalid(() => Planner.Calculate(Plan(limit: 120, margin: 120))); Invalid(() => Planner.Calculate(Plan(limit: 120, margin: 121))); });
Test("duplicate entry IDs rejected but same track allowed", () => { var a = Item(); Invalid(() => Planner.Calculate(Plan([a, a]))); Planner.Calculate(Plan([a, a with { EntryId = "other" }])); });
Test("blank title and unknown energy rejected", () => { Invalid(() => Planner.Calculate(Plan([Item() with { Title = " " }]))); Invalid(() => Planner.Calculate(Plan([Item() with { Energy = "unknown" }]))); });
Test("maximum set size enforced", () => Invalid(() => Planner.Calculate(Plan(Enumerable.Range(0, 101).Select(_ => Item()).ToList()))));
Test("null item rejected safely", () => Invalid(() => Planner.Calculate(Plan([null!]))));
var failures = 0;
foreach (var (name, test) in tests) { try { test(); Console.WriteLine($"PASS {name}"); } catch (Exception e) { failures++; Console.WriteLine($"FAIL {name}: {e.Message}"); } }
Console.WriteLine($"{tests.Count - failures}/{tests.Count} passed");
return failures == 0 ? 0 : 1;
