// Setup-only helper. Targets the .NET Framework included in Windows 10/11;
// it does not need the companion's .NET runtime to have been installed yet.
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Web.Script.Serialization;

internal static class ExtensionDetector
{
    private const int MaxJsonBytes = 16 * 1024 * 1024;
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer
    {
        MaxJsonLength = MaxJsonBytes,
        RecursionLimit = 128
    };

    private static int Main(string[] args)
    {
        try
        {
            string output = null;
            string customRoot = null;
            for (int i = 0; i < args.Length; i += 2)
            {
                if (i + 1 >= args.Length) return 2;
                if (args[i] == "--output") output = args[i + 1];
                else if (args[i] == "--user-data-dir") customRoot = args[i + 1];
                else return 2;
            }
            if (String.IsNullOrEmpty(output)) return 2;

            var ids = new SortedSet<string>(StringComparer.Ordinal);
            string localData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            var roots = customRoot == null
                ? new[] { "Chrome", "Chrome Beta", "Chrome Dev", "Chrome SxS", "Chrome for Testing" }
                    .Select(channel => Path.Combine(localData, "Google", channel, "User Data"))
                : new[] { customRoot };
            foreach (string root in roots) ScanRoot(root, ids);
            // Never silently drop some discovered installations or authorize a wildcard.
            if (ids.Count > 10) return 1;
            File.WriteAllText(output, String.Join(",", ids), new UTF8Encoding(false));
            return 0;
        }
        catch { return 1; } // Setup will retain its manual-pairing fallback.
    }

    private static void ScanRoot(string root, ISet<string> ids)
    {
        try
        {
            if (!IsLocalPath(root) || !Directory.Exists(root)) return;
            foreach (string profile in Directory.EnumerateDirectories(root).Take(256))
            {
                if ((File.GetAttributes(profile) & FileAttributes.ReparsePoint) != 0) continue;
                // Secure Preferences wins if an ID is present in both preference stores.
                var records = new Dictionary<string, Dictionary<string, object>>(StringComparer.Ordinal);
                foreach (string filename in new[] { "Preferences", "Secure Preferences" })
                {
                    var settings = Map(Get(Map(Get(ReadJson(Path.Combine(profile, filename)), "extensions")), "settings"));
                    if (settings == null) continue;
                    foreach (var pair in settings)
                    {
                        var record = Map(pair.Value);
                        if (IsId(pair.Key) && record != null) records[pair.Key] = record;
                    }
                }
                foreach (var record in records)
                {
                    try { if (IsPikaNav(profile, record.Value)) ids.Add(record.Key); }
                    catch { /* An inaccessible or partly updated extension is not a match. */ }
                }
            }
        }
        catch { /* An unavailable Chrome channel must not prevent scanning the others. */ }
    }

    private static bool IsPikaNav(string profile, Dictionary<string, object> record)
    {
        // Historical records remain after uninstall; only existing local files qualify.
        object state = Get(record, "state");
        if (state != null && Convert.ToInt32(state) != 1) return false;
        object reasons = Get(record, "disable_reasons");
        if (reasons is ICollection && ((ICollection)reasons).Count != 0) return false;
        if (reasons is int && (int)reasons != 0) return false;
        string extensionPath = Get(record, "path") as string;
        if (String.IsNullOrEmpty(extensionPath)) return false;
        if (!Path.IsPathRooted(extensionPath))
        {
            string extensionRoot = Path.GetFullPath(Path.Combine(profile, "Extensions")) + Path.DirectorySeparatorChar;
            extensionPath = Path.GetFullPath(Path.Combine(extensionRoot, extensionPath));
            if (!extensionPath.StartsWith(extensionRoot, StringComparison.OrdinalIgnoreCase)) return false;
        }
        if (!IsLocalPath(extensionPath)) return false;
        var manifest = ReadJson(Path.Combine(extensionPath, "manifest.json"));
        if (!String.Equals(Get(manifest, "name") as string, "PikaNav", StringComparison.Ordinal)) return false;
        if (!Object.Equals(Get(manifest, "manifest_version"), 3)) return false;
        if (!String.Equals(Get(Map(Get(manifest, "chrome_url_overrides")), "newtab") as string, "index.html", StringComparison.Ordinal)) return false;
        var permissions = Get(manifest, "permissions") as IEnumerable;
        if (permissions == null || !permissions.Cast<object>().Contains("nativeMessaging")) return false;
        var background = Map(Get(manifest, "background"));
        if (!String.Equals(Get(background, "service_worker") as string, "background.js", StringComparison.Ordinal)) return false;
        string worker = ReadText(Path.Combine(extensionPath, "background.js"));
        return worker != null && worker.Contains("com.pikanav.media") && worker.Contains("getSystemStats")
            && File.Exists(Path.Combine(extensionPath, "index.html"));
    }

    private static bool IsId(string value)
    {
        return value.Length == 32 && value.All(c => c >= 'a' && c <= 'p');
    }

    private static bool IsLocalPath(string value)
    {
        // Avoid network shares, device paths, and relative drive paths during setup.
        return value.Length >= 3 && Char.IsLetter(value[0]) && value[1] == ':'
            && (value[2] == '\\' || value[2] == '/');
    }

    private static object Get(Dictionary<string, object> value, string key)
    {
        object result;
        return value != null && value.TryGetValue(key, out result) ? result : null;
    }

    private static Dictionary<string, object> Map(object value)
    {
        return value as Dictionary<string, object>;
    }

    private static Dictionary<string, object> ReadJson(string filename)
    {
        try { string text = ReadText(filename); return text == null ? null : Map(Json.DeserializeObject(text)); }
        catch { return null; }
    }

    private static string ReadText(string filename)
    {
        try
        {
            using (var stream = new FileStream(filename, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
            {
                if (stream.Length > MaxJsonBytes) return null;
                using (var reader = new StreamReader(stream, Encoding.UTF8, true)) return reader.ReadToEnd();
            }
        }
        catch { return null; }
    }
}
