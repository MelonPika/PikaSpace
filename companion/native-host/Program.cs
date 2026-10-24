using System.Text;
using System.Text.Json;
using System.Runtime.InteropServices;
using Windows.Foundation;
using Windows.Graphics.Imaging;
using Windows.Media.Control;
using Windows.Storage.Streams;

const string HostName = "PikaNav.MediaHost";
const uint MaxArtworkDimension = 320;
// Base64 expands artwork by 4/3; leave room below Chrome's 1 MiB response limit.
const ulong MaxEncodedArtworkBytes = 600 * 1024;

try
{
    await RunAsync();
}
catch (Exception ex)
{
    LogError(ex);
}

static async Task RunAsync()
{
    using Stream input = Console.OpenStandardInput();
    using Stream output = Console.OpenStandardOutput();

    while (true)
    {
        string? message = await ReadNativeMessageAsync(input);
        if (message is null)
        {
            break;
        }

        object response = await HandleMessageAsync(message);
        await WriteNativeMessageAsync(output, response);
    }
}

static async Task<string?> ReadNativeMessageAsync(Stream input)
{
    byte[] lengthBytes = new byte[4];
    int lengthRead = await ReadExactAsync(input, lengthBytes, 4);
    if (lengthRead == 0)
    {
        return null;
    }

    if (lengthRead < 4)
    {
        throw new InvalidDataException("Incomplete native message length.");
    }

    int messageLength = BitConverter.ToInt32(lengthBytes, 0);
    if (messageLength <= 0 || messageLength > 1024 * 1024)
    {
        throw new InvalidDataException("Invalid native message length.");
    }

    byte[] messageBytes = new byte[messageLength];
    int messageRead = await ReadExactAsync(input, messageBytes, messageLength);
    if (messageRead < messageLength)
    {
        throw new InvalidDataException("Incomplete native message payload.");
    }

    return Encoding.UTF8.GetString(messageBytes);
}

static async Task<int> ReadExactAsync(Stream input, byte[] buffer, int count)
{
    int offset = 0;
    while (offset < count)
    {
        int read = await input.ReadAsync(buffer.AsMemory(offset, count - offset));
        if (read == 0)
        {
            break;
        }

        offset += read;
    }

    return offset;
}

static async Task WriteNativeMessageAsync(Stream output, object response)
{
    byte[] payload = JsonSerializer.SerializeToUtf8Bytes(response, new JsonSerializerOptions
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    });
    if (payload.Length > 1024 * 1024)
    {
        payload = JsonSerializer.SerializeToUtf8Bytes(new { ok = false, error = "Native response exceeds Chrome's message limit. Try media without large artwork or metadata." });
    }
    byte[] length = BitConverter.GetBytes(payload.Length);
    await output.WriteAsync(length);
    await output.WriteAsync(payload);
    await output.FlushAsync();
}

static async Task<object> HandleMessageAsync(string message)
{
    try
    {
        using JsonDocument document = JsonDocument.Parse(message);
        string? type = document.RootElement.TryGetProperty("type", out JsonElement typeElement)
            ? typeElement.GetString()
            : null;

        return type switch
        {
            "ping" => new { ok = true, version = typeof(SystemStatsService).Assembly.GetName().Version?.ToString(3), host = HostName },
            "getCurrentMedia" => await GetCurrentMediaAsync(),
            "getSystemStats" => await new SystemStatsService().GetSystemStatsAsync(),
            "playPause" => await ControlCurrentSessionAsync(session => session.TryTogglePlayPauseAsync()),
            "next" => await ControlCurrentSessionAsync(session => session.TrySkipNextAsync()),
            "previous" => await ControlCurrentSessionAsync(session => session.TrySkipPreviousAsync()),
            _ => new { ok = false, error = "Unknown command" }
        };
    }
    catch (JsonException)
    {
        return new { ok = false, error = "Invalid JSON" };
    }
    catch (Exception ex)
    {
        LogError(ex);
        return new { ok = false, error = FormatErrorMessage(ex) };
    }
}

static async Task<object> GetCurrentMediaAsync()
{
    GlobalSystemMediaTransportControlsSession? session = await GetCurrentSessionAsync();
    if (session is null)
    {
        return new { ok = true, hasSession = false };
    }

    GlobalSystemMediaTransportControlsSessionMediaProperties media =
        await session.TryGetMediaPropertiesAsync();
    GlobalSystemMediaTransportControlsSessionPlaybackInfo playbackInfo =
        session.GetPlaybackInfo();
    string artworkUrl = await ReadThumbnailDataUrlAsync(media.Thumbnail);

    return new
    {
        ok = true,
        hasSession = true,
        title = media.Title ?? "",
        artist = media.Artist ?? "",
        album = media.AlbumTitle ?? "",
        sourceAppUserModelId = session.SourceAppUserModelId ?? "",
        playbackStatus = playbackInfo.PlaybackStatus.ToString(),
        artworkUrl
    };
}

static async Task<object> ControlCurrentSessionAsync(
    Func<GlobalSystemMediaTransportControlsSession, IAsyncOperation<bool>> action)
{
    GlobalSystemMediaTransportControlsSession? session = await GetCurrentSessionAsync();
    if (session is null)
    {
        return new { ok = false, error = "No active media session" };
    }

    bool succeeded = await action(session);
    return succeeded
        ? new { ok = true }
        : new { ok = false, error = "Media command was not accepted by the active session" };
}

static async Task<GlobalSystemMediaTransportControlsSession?> GetCurrentSessionAsync()
{
    GlobalSystemMediaTransportControlsSessionManager manager =
        await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
    return manager.GetCurrentSession();
}

static async Task<string> ReadThumbnailDataUrlAsync(IRandomAccessStreamReference? thumbnail)
{
    if (thumbnail is null)
    {
        return "";
    }

    try
    {
        using IRandomAccessStreamWithContentType stream = await thumbnail.OpenReadAsync();
        if (stream.Size == 0)
        {
            return "";
        }

        try
        {
            return await EncodeThumbnailAsJpegDataUrlAsync(stream);
        }
        catch (Exception ex)
        {
            LogError(ex);
            return await ReadRawThumbnailDataUrlAsync(stream);
        }
    }
    catch (Exception ex)
    {
        LogError(ex);
        return "";
    }
}

static async Task<string> EncodeThumbnailAsJpegDataUrlAsync(IRandomAccessStream input)
{
    input.Seek(0);
    BitmapDecoder decoder = await BitmapDecoder.CreateAsync(input);
    uint width = decoder.PixelWidth;
    uint height = decoder.PixelHeight;
    if (width == 0 || height == 0)
    {
        return "";
    }

    double scale = Math.Min(1d, MaxArtworkDimension / (double)Math.Max(width, height));
    uint scaledWidth = Math.Max(1, (uint)Math.Round(width * scale));
    uint scaledHeight = Math.Max(1, (uint)Math.Round(height * scale));

    BitmapTransform transform = new()
    {
        ScaledWidth = scaledWidth,
        ScaledHeight = scaledHeight,
        InterpolationMode = BitmapInterpolationMode.Fant
    };

    PixelDataProvider pixels = await decoder.GetPixelDataAsync(
        BitmapPixelFormat.Bgra8,
        BitmapAlphaMode.Premultiplied,
        transform,
        ExifOrientationMode.IgnoreExifOrientation,
        ColorManagementMode.DoNotColorManage);

    using InMemoryRandomAccessStream output = new();
    BitmapEncoder encoder = await BitmapEncoder.CreateAsync(BitmapEncoder.JpegEncoderId, output);
    encoder.SetPixelData(
        BitmapPixelFormat.Bgra8,
        BitmapAlphaMode.Premultiplied,
        scaledWidth,
        scaledHeight,
        96,
        96,
        pixels.DetachPixelData());
    await encoder.FlushAsync();

    if (output.Size == 0 || output.Size > MaxEncodedArtworkBytes)
    {
        return "";
    }

    byte[] encodedBytes = new byte[output.Size];
    using DataReader reader = new(output.GetInputStreamAt(0));
    await reader.LoadAsync((uint)output.Size);
    reader.ReadBytes(encodedBytes);
    return $"data:image/jpeg;base64,{Convert.ToBase64String(encodedBytes)}";
}

static async Task<string> ReadRawThumbnailDataUrlAsync(IRandomAccessStreamWithContentType stream)
{
    if (stream.Size == 0 || stream.Size > MaxEncodedArtworkBytes)
    {
        return "";
    }

    byte[] bytes = new byte[stream.Size];
    using DataReader reader = new(stream.GetInputStreamAt(0));
    await reader.LoadAsync((uint)stream.Size);
    reader.ReadBytes(bytes);

    string contentType = string.IsNullOrWhiteSpace(stream.ContentType)
        ? "image/jpeg"
        : stream.ContentType;
    return $"data:{contentType};base64,{Convert.ToBase64String(bytes)}";
}

static string FormatErrorMessage(Exception ex)
{
    const int ServiceDoesNotExist = unchecked((int)0x80070424);

    if (ex is COMException comException && comException.HResult == ServiceDoesNotExist)
    {
        return "Windows media session service is unavailable on this system.";
    }

    return string.IsNullOrWhiteSpace(ex.Message)
        ? "Windows media session request failed."
        : ex.Message;
}

static void LogError(Exception ex)
{
    try
    {
        string logDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "PikaNav",
            "MediaHost",
            "logs");
        Directory.CreateDirectory(logDir);
        string logPath = Path.Combine(logDir, "media-host.log");
        File.AppendAllText(logPath, $"[{DateTimeOffset.Now:u}] {ex}\n");
    }
    catch
    {
        Console.Error.WriteLine(ex);
    }
}
