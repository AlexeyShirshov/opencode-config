using System.Text;
using Microsoft.Build.Locator;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.FindSymbols;
using Microsoft.CodeAnalysis.MSBuild;
using Microsoft.CodeAnalysis.Rename;

MSBuildLocator.RegisterDefaults();

if (args.Length < 2)
{
    PrintUsage();
    return 1;
}

var slnPath = Path.GetFullPath(args[0]);
var verb = args[1].ToLowerInvariant();
var rest = args.Skip(2).ToArray();

if (!File.Exists(slnPath))
{
    Console.Error.WriteLine($"error: solution not found: {slnPath}");
    return 1;
}

var slnDir = Path.GetDirectoryName(slnPath)!;

using var workspace = MSBuildWorkspace.Create();
workspace.RegisterWorkspaceFailedHandler(e =>
{
    if (e.Diagnostic.Kind == WorkspaceDiagnosticKind.Failure)
        Console.Error.WriteLine($"warn: {e.Diagnostic.Message}");
});

Solution solution;
try
{
    solution = await workspace.OpenSolutionAsync(slnPath);
}
catch (Exception ex)
{
    Console.Error.WriteLine($"error: cannot open solution: {ex.Message}");
    return 1;
}

try
{
    switch (verb)
    {
        case "structure": await Structure(); break;
        case "types": await Types(Arg(rest, 0)); break;
        case "symbols": await Symbols(Arg(rest, 0)); break;
        case "members": await Members(Arg(rest, 0)); break;
        case "refs": await Refs(Arg(rest, 0)); break;
        case "callers": await Callers(Arg(rest, 0)); break;
        case "implementations": await Implementations(Arg(rest, 0)); break;
        case "rename": await Rename(Arg(rest, 0), Arg(rest, 1), rest.Contains("--apply")); break;
        default:
            Console.Error.WriteLine($"error: unknown action '{verb}'");
            PrintUsage();
            return 1;
    }
}
catch (Exception ex)
{
    Console.Error.WriteLine($"error: {ex.Message}");
    return 1;
}

return 0;

// ---------------------------------------------------------------- helpers

static string Arg(string[] a, int i)
    => i < a.Length ? a[i] : throw new ArgumentException($"missing argument #{i + 1}");

void PrintUsage()
{
    Console.Error.WriteLine("""
        usage: roslynq <solution.sln> <action> [args]

          structure                     projects and top namespaces
          types <pattern>               find types by simple-name substring
          symbols <name>                definition of a type or member
          members <type>                members of a type
          refs <name>                   all references to a symbol
          callers <name>                call sites of a method/property
          implementations <name>        implementations of an interface/abstract member
          rename <name> <newName> [--apply]
                                        dry-run rename; --apply writes files
        """);
}

string Loc(Location? location)
{
    if (location is null || !location.IsInSource) return "<no location>";
    var span = location.GetLineSpan();
    var file = span.Path;
    try { file = Path.GetRelativePath(slnDir, file); } catch { /* keep absolute */ }
    return $"{file}:{span.StartLinePosition.Line + 1}:{span.StartLinePosition.Character + 1}";
}

string Kind(ISymbol s) => s switch
{
    INamedTypeSymbol t => t.TypeKind.ToString().ToLowerInvariant(),
    IMethodSymbol m when m.MethodKind == MethodKind.Constructor => "constructor",
    IMethodSymbol m when m.MethodKind == MethodKind.LocalFunction => "local-function",
    IMethodSymbol => "method",
    IPropertySymbol => "property",
    IFieldSymbol => "field",
    IEventSymbol => "event",
    INamespaceSymbol => "namespace",
    IParameterSymbol => "parameter",
    _ => s.Kind.ToString().ToLowerInvariant()
};

async Task<INamedTypeSymbol?> ResolveType(string name)
{
    foreach (var project in solution.Projects)
    {
        var compilation = await project.GetCompilationAsync();
        if (compilation?.GetTypeByMetadataName(name) is INamedTypeSymbol byMeta)
            return byMeta;
    }

    var simple = name.Contains('.') ? name[(name.LastIndexOf('.') + 1)..] : name;
    foreach (var project in solution.Projects)
    {
        var compilation = await project.GetCompilationAsync();
        if (compilation is null) continue;
        foreach (var candidate in compilation.GetSymbolsWithName(s => s == simple, SymbolFilter.Type))
        {
            if (candidate is not INamedTypeSymbol type) continue;
            var display = type.ToDisplayString();
            if (display == name || display.EndsWith("." + name))
                return type;
        }
    }

    return null;
}

async Task<ISymbol?> Resolve(string name)
{
    if (await ResolveType(name) is { } exact)
        return exact;

    if (name.Contains('.'))
    {
        var idx = name.LastIndexOf('.');
        var type = await ResolveType(name[..idx]);
        if (type is not null)
        {
            var members = type.GetMembers(name[(idx + 1)..]);
            if (members.Length > 0) return members[0];
        }
    }

    var simple = name.Contains('.') ? name[(name.LastIndexOf('.') + 1)..] : name;
    foreach (var project in solution.Projects)
    {
        var compilation = await project.GetCompilationAsync();
        if (compilation is null) continue;
        foreach (var candidate in compilation.GetSymbolsWithName(s => s == simple, SymbolFilter.TypeAndMember))
        {
            var display = candidate.ToDisplayString();
            if (display == name || display.EndsWith("." + name) || candidate.Name == simple)
                return candidate;
        }
    }

    return null;
}

string RelPath(string? path)
{
    if (path is null) return "<unknown>";
    try { return Path.GetRelativePath(slnDir, path); } catch { return path; }
}

async Task Structure()
{
    foreach (var project in solution.Projects.OrderBy(p => p.Name, StringComparer.OrdinalIgnoreCase))
    {
        var compilation = await project.GetCompilationAsync();
        if (compilation is null) continue;
        var global = compilation.GlobalNamespace;
        var types = CountTypes(global);
        var namespaces = SourceNamespaces(global).Select(n => n.ToDisplayString()).OrderBy(n => n, StringComparer.Ordinal).ToList();

        Console.WriteLine($"# {project.Name}");
        Console.WriteLine($"  path:       {RelPath(project.FilePath)}");
        Console.WriteLine($"  types:      {types}");
        Console.WriteLine($"  namespaces: {namespaces.Count}");
        foreach (var ns in namespaces.Take(20))
            Console.WriteLine($"    {ns}");
        if (namespaces.Count > 20)
            Console.WriteLine($"    ... (+{namespaces.Count - 20} more)");
    }
}

static IEnumerable<INamespaceSymbol> SourceNamespaces(INamespaceSymbol ns)
{
    foreach (var child in ns.GetNamespaceMembers())
    {
        if (child.DeclaringSyntaxReferences.Length > 0) yield return child;
        foreach (var nested in SourceNamespaces(child)) yield return nested;
    }
}

static int CountTypes(INamespaceSymbol ns)
    => ns.GetTypeMembers().Count(t => t.DeclaringSyntaxReferences.Length > 0)
       + ns.GetNamespaceMembers().Sum(CountTypes);

async Task Types(string pattern)
{
    var found = 0;
    foreach (var project in solution.Projects.OrderBy(p => p.Name, StringComparer.OrdinalIgnoreCase))
    {
        var compilation = await project.GetCompilationAsync();
        if (compilation is null) continue;
        foreach (var type in compilation.GetSymbolsWithName(
                     n => n.Contains(pattern, StringComparison.OrdinalIgnoreCase),
                     SymbolFilter.Type))
        {
            if (type is not INamedTypeSymbol named) continue;
            Console.WriteLine($"{named.ToDisplayString()}  [{Kind(named)}]  {Loc(named.Locations.FirstOrDefault())}");
            if (++found >= 200) { Console.WriteLine("... (truncated at 200)"); return; }
        }
    }
    if (found == 0) Console.WriteLine($"(no types matching '{pattern}')");
}

async Task Symbols(string name)
{
    var symbol = await Resolve(name);
    if (symbol is null) { Console.WriteLine($"(symbol not found: {name})"); return; }
    Console.WriteLine($"{symbol.ToDisplayString()}");
    Console.WriteLine($"  kind:      {Kind(symbol)}");
    Console.WriteLine($"  namespace: {symbol.ContainingNamespace?.ToDisplayString()}");
    Console.WriteLine($"  assembly:  {symbol.ContainingAssembly?.Name}");
    Console.WriteLine($"  location:  {Loc(symbol.Locations.FirstOrDefault())}");
    if (symbol is INamedTypeSymbol type)
        Console.WriteLine($"  members:   {type.GetMembers().Length}");
}

async Task Members(string name)
{
    var symbol = await Resolve(name);
    if (symbol is not INamedTypeSymbol type)
    {
        Console.WriteLine(symbol is null ? $"(type not found: {name})" : $"(not a type: {name})");
        return;
    }
    Console.WriteLine($"{type.ToDisplayString()}");
    foreach (var member in type.GetMembers().OrderBy(m => m.Name, StringComparer.Ordinal))
    {
        if (member is IMethodSymbol { MethodKind: MethodKind.Constructor or MethodKind.StaticConstructor } ctor && ctor.IsImplicitlyDeclared)
            continue;
        var access = member.DeclaredAccessibility.ToString().ToLowerInvariant();
        var loc = member.Locations.FirstOrDefault(l => l.IsInSource);
        Console.WriteLine($"  {access} {Kind(member)} {member.ToDisplayString()}  {Loc(loc)}");
    }
}

async Task Refs(string name)
{
    var symbol = await Resolve(name);
    if (symbol is null) { Console.WriteLine($"(symbol not found: {name})"); return; }
    var refs = await SymbolFinder.FindReferencesAsync(symbol, solution);
    var total = 0;
    foreach (var group in refs)
    {
        Console.WriteLine($"def {Loc(group.Definition.Locations.FirstOrDefault())}  {group.Definition.ToDisplayString()}");
        foreach (var loc in group.Locations.OrderBy(l => l.Location.GetLineSpan().Path, StringComparer.Ordinal))
        {
            Console.WriteLine($"  {Loc(loc.Location)}");
            total++;
        }
    }
    Console.WriteLine($"{total} reference(s)");
}

async Task Callers(string name)
{
    var symbol = await Resolve(name);
    if (symbol is not IMethodSymbol and not IPropertySymbol)
    {
        Console.WriteLine(symbol is null ? $"(symbol not found: {name})" : $"(not callable: {name})");
        return;
    }
    var callers = await SymbolFinder.FindCallersAsync(symbol, solution);
    var total = 0;
    foreach (var call in callers)
    {
        Console.WriteLine($"{call.CallingSymbol.ToDisplayString()}");
        foreach (var loc in call.Locations)
        {
            Console.WriteLine($"  {Loc(loc)}");
            total++;
        }
    }
    Console.WriteLine($"{total} call site(s)");
}

async Task Implementations(string name)
{
    var symbol = await Resolve(name);
    if (symbol is null) { Console.WriteLine($"(symbol not found: {name})"); return; }
    var impls = await SymbolFinder.FindImplementationsAsync(symbol, solution);
    var total = 0;
    foreach (var impl in impls)
    {
        Console.WriteLine($"{Kind(impl)} {impl.ToDisplayString()}  {Loc(impl.Locations.FirstOrDefault())}");
        total++;
    }
    Console.WriteLine($"{total} implementation(s)");
}

async Task Rename(string name, string newName, bool apply)
{
    var symbol = await Resolve(name);
    if (symbol is null) { Console.WriteLine($"(symbol not found: {name})"); return; }
    var renamed = await Renamer.RenameSymbolAsync(solution, symbol, new SymbolRenameOptions(), newName);

    var changed = 0;
    foreach (var projectChange in renamed.GetChanges(solution).GetProjectChanges())
    {
        foreach (var docId in projectChange.GetChangedDocuments())
        {
            var oldDoc = solution.GetDocument(docId);
            var newDoc = renamed.GetDocument(docId);
            if (oldDoc is null || newDoc is null) continue;
            var oldText = await oldDoc.GetTextAsync();
            var newText = await newDoc.GetTextAsync();
            if (oldText.ContentEquals(newText)) continue;

            var path = oldDoc.FilePath ?? "<unknown>";
            try { path = Path.GetRelativePath(slnDir, path); } catch { /* keep absolute */ }
            Console.WriteLine($"~ {path}");

            if (apply && oldDoc.FilePath is not null)
            {
                var encoding = newText.Encoding ?? new UTF8Encoding(encoderShouldEmitUTF8Identifier: false);
                await File.WriteAllTextAsync(oldDoc.FilePath, newText.ToString(), encoding);
            }
            changed++;
        }
    }

    Console.WriteLine(apply
        ? $"applied rename '{name}' -> '{newName}' in {changed} document(s)"
        : $"dry-run: {changed} document(s) would change (pass --apply to write)");
}
