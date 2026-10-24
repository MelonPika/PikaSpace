using System.Diagnostics;
using System.Runtime.InteropServices;

internal sealed class SystemStatsService
{
    private const int CpuSampleDelayMs = 250;

    public async Task<SystemStatsResponse> GetSystemStatsAsync()
    {
        CpuTimes firstCpuTimes = CpuTimes.Read();
        await Task.Delay(CpuSampleDelayMs);
        CpuTimes secondCpuTimes = CpuTimes.Read();

        CpuStats cpu = new(Math.Round(CpuTimes.CalculateUsagePercent(firstCpuTimes, secondCpuTimes), 1));
        MemoryStats memory = GetMemoryStats();
        List<DiskStats> disk = GetDiskStats();
        GpuStats gpu = GetGpuStats();

        return new SystemStatsResponse(true, cpu, memory, disk, gpu);
    }

    private static MemoryStats GetMemoryStats()
    {
        MemoryStatusEx status = new()
        {
            Length = (uint)Marshal.SizeOf<MemoryStatusEx>()
        };

        if (!GlobalMemoryStatusEx(ref status))
        {
            throw new InvalidOperationException("Unable to read Windows memory status.");
        }

        double totalMb = BytesToMb(status.TotalPhys);
        double availableMb = BytesToMb(status.AvailPhys);
        double usedMb = Math.Max(0, totalMb - availableMb);
        double usagePercent = totalMb <= 0 ? 0 : usedMb / totalMb * 100;

        return new MemoryStats(
            Math.Round(usedMb, 0),
            Math.Round(totalMb, 0),
            Math.Round(usagePercent, 1));
    }

    private static List<DiskStats> GetDiskStats()
    {
        List<DiskStats> disks = [];

        foreach (DriveInfo drive in DriveInfo.GetDrives())
        {
            if (!drive.IsReady || drive.DriveType != DriveType.Fixed)
            {
                continue;
            }

            double totalGb = BytesToGb((ulong)drive.TotalSize);
            double freeGb = BytesToGb((ulong)drive.AvailableFreeSpace);
            double usedGb = Math.Max(0, totalGb - freeGb);
            double usagePercent = totalGb <= 0 ? 0 : usedGb / totalGb * 100;

            disks.Add(new DiskStats(
                drive.Name,
                Math.Round(usedGb, 1),
                Math.Round(totalGb, 1),
                Math.Round(usagePercent, 1)));
        }

        return disks;
    }

    private static GpuStats GetGpuStats()
    {
        return new GpuStats(
            null,
            null,
            null,
            "GPU stats may not be available on all systems");
    }

    private static double BytesToMb(ulong bytes) => bytes / 1024d / 1024d;

    private static double BytesToGb(ulong bytes) => bytes / 1024d / 1024d / 1024d;

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GlobalMemoryStatusEx(ref MemoryStatusEx buffer);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetSystemTimes(
        out FileTime idleTime,
        out FileTime kernelTime,
        out FileTime userTime);

    [StructLayout(LayoutKind.Sequential)]
    private struct MemoryStatusEx
    {
        public uint Length;
        public uint MemoryLoad;
        public ulong TotalPhys;
        public ulong AvailPhys;
        public ulong TotalPageFile;
        public ulong AvailPageFile;
        public ulong TotalVirtual;
        public ulong AvailVirtual;
        public ulong AvailExtendedVirtual;
    }

    [StructLayout(LayoutKind.Sequential)]
    private readonly struct FileTime
    {
        private readonly uint LowDateTime;
        private readonly uint HighDateTime;

        public ulong ToUInt64() => ((ulong)HighDateTime << 32) | LowDateTime;
    }

    private readonly record struct CpuTimes(ulong Idle, ulong Kernel, ulong User)
    {
        public static CpuTimes Read()
        {
            if (!GetSystemTimes(out FileTime idleTime, out FileTime kernelTime, out FileTime userTime))
            {
                throw new InvalidOperationException("Unable to read Windows CPU status.");
            }

            return new CpuTimes(idleTime.ToUInt64(), kernelTime.ToUInt64(), userTime.ToUInt64());
        }

        public static double CalculateUsagePercent(CpuTimes first, CpuTimes second)
        {
            ulong idle = second.Idle - first.Idle;
            ulong kernel = second.Kernel - first.Kernel;
            ulong user = second.User - first.User;
            ulong total = kernel + user;

            if (total == 0 || idle > total)
            {
                return 0;
            }

            return Math.Clamp((total - idle) * 100d / total, 0, 100);
        }
    }
}

internal sealed record SystemStatsResponse(
    bool Ok,
    CpuStats Cpu,
    MemoryStats Memory,
    List<DiskStats> Disk,
    GpuStats Gpu);

internal sealed record CpuStats(double UsagePercent);

internal sealed record MemoryStats(double UsedMb, double TotalMb, double UsagePercent);

internal sealed record DiskStats(string Name, double UsedGb, double TotalGb, double UsagePercent);

internal sealed record GpuStats(
    double? UsagePercent,
    double? MemoryUsedMb,
    double? MemoryTotalMb,
    string Note);
