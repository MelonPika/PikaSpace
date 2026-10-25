; Build with scripts/build-companion.ps1. Only explicitly paired extensions can connect.
#ifndef AppVersion
  #error AppVersion is required
#endif
#ifndef HostSource
  #error HostSource is required
#endif
#ifndef ReleaseDir
  #error ReleaseDir is required
#endif
#ifndef DetectorSource
  #error DetectorSource is required
#endif
#ifndef StableExtensionId
  #error StableExtensionId is required
#endif
#ifndef DefaultExtensionIds
  #define DefaultExtensionIds ""
#endif
#ifdef InstallerTestMode
  #define ProductId "PikaNav.WindowsCompanion.InstallerTest"
  #define ProductName "PikaDesk · 皮卡桌面 Companion Installer Test"
  #define HostRegistryKey "Software\PikaNav\InstallerTests\NativeMessagingHosts\com.pikanav.media"
#else
  #define ProductId "PikaNav.WindowsCompanion"
  #define ProductName "PikaDesk · 皮卡桌面 Windows Companion"
  #define HostRegistryKey "Software\Google\Chrome\NativeMessagingHosts\com.pikanav.media"
#endif

[Setup]
AppId={#ProductId}
AppName={#ProductName}
AppVersion={#AppVersion}
AppPublisher=PikaDesk · 皮卡桌面
AppPublisherURL=https://github.com/MelonPika/PikaSpace
AppSupportURL=https://github.com/MelonPika/PikaSpace/issues
AppUpdatesURL=https://github.com/MelonPika/PikaSpace/releases
VersionInfoDescription=PikaDesk · 皮卡桌面 Windows Companion Setup
DefaultDirName={localappdata}\PikaNav\MediaHost
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
MinVersion=10.0.19041
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir={#ReleaseDir}
OutputBaseFilename=PikaDesk-Companion-{#AppVersion}-Setup-x64
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\PikaNav.MediaHost.exe
CloseApplications=yes
RestartApplications=no
SetupLogging=yes
DisableWelcomePage=no
UsePreviousAppDir=yes

[Messages]
WelcomeLabel2=This helper connects PikaDesk · 皮卡桌面 to Windows desktop music and CPU, RAM, and disk information.%n%nIt runs only when Chrome requests it. No startup app or Windows service is installed, and no administrator password is needed.%n%nThe required runtime is included. You do not need to install .NET or run any commands.
FinishedLabel=The PikaDesk · 皮卡桌面 Windows Companion is installed.%n%nReturn to PikaDesk · 皮卡桌面 and refresh the dashboard. Desktop music and system information are now available when supported by Windows and the media app.%n%nYou can remove the companion from Windows Settings > Apps at any time.

[Files]
Source: "{#DetectorSource}"; Flags: dontcopy
Source: "{#HostSource}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; Prepared before any files or registration are changed, and tracked for uninstall.
Source: "{tmp}\com.pikanav.media.json"; DestDir: "{app}"; Flags: external ignoreversion
Source: "INSTALL.txt"; DestDir: "{app}"; Flags: ignoreversion

[Registry]
Root: HKCU32; Subkey: "{#HostRegistryKey}"; ValueType: string; ValueName: ""; ValueData: "{app}\com.pikanav.media.json"
Root: HKCU64; Subkey: "{#HostRegistryKey}"; ValueType: string; ValueName: ""; ValueData: "{app}\com.pikanav.media.json"

[Code]
var
  ExtensionPage: TInputQueryWizardPage;
  AutomaticPairing: Boolean;
  PairingMode: TInputOptionWizardPage;
  DetectStatus: TNewStaticText;
  DetectAgainButton: TNewButton;

procedure SplitExtensionIds(Value: String; var Ids: TArrayOfString);
var
  Separator, Count: Integer;
begin
  SetArrayLength(Ids, 0);
  repeat
    Separator := Pos(',', Value);
    Count := GetArrayLength(Ids);
    SetArrayLength(Ids, Count + 1);
    if Separator = 0 then begin
      Ids[Count] := Trim(Value);
      Break;
    end;
    Ids[Count] := Trim(Copy(Value, 1, Separator - 1));
    Delete(Value, 1, Separator);
  until False;
end;

function ExtensionIdsAreValid(Value: String): Boolean;
var
  Ids: TArrayOfString;
  Id: String;
  I, J: Integer;
begin
  Result := False;
  SplitExtensionIds(Value, Ids);
  if (GetArrayLength(Ids) = 0) or (GetArrayLength(Ids) > 10) then Exit;
  for I := 0 to GetArrayLength(Ids) - 1 do begin
    Id := Trim(Ids[I]);
    if Length(Id) <> 32 then Exit;
    for J := 1 to Length(Id) do
      if (Id[J] < 'a') or (Id[J] > 'p') then Exit;
  end;
  Result := True;
end;

function MergeExtensionIds(First, Second: String): String;
var
  Ids: TArrayOfString;
  I: Integer;
begin
  Result := First;
  if Second = '' then Exit;
  SplitExtensionIds(Second, Ids);
  for I := 0 to GetArrayLength(Ids) - 1 do
    if Pos(',' + Trim(Ids[I]) + ',', ',' + Result + ',') = 0 then begin
      if Result <> '' then Result := Result + ',';
      Result := Result + Trim(Ids[I]);
    end;
end;

function DetectExtensionIds: String;
var
  ExitCode: Integer;
  OutputPath, Parameters, CustomRoot: String;
  Detected: AnsiString;
begin
  Result := '';
  OutputPath := ExpandConstant('{tmp}\pikanav-detected-ids.txt');
  DeleteFile(OutputPath);
  try
    ExtractTemporaryFile('PikaNav.ExtensionDetector.exe');
    Parameters := '--output "' + OutputPath + '"';
    CustomRoot := ExpandConstant('{param:CHROMEDATADIR|}');
#ifdef InstallerTestMode
    { Tests never read the user's real Chrome profiles. }
    if CustomRoot = '' then Exit;
#endif
    if (CustomRoot <> '') and (Pos('"', CustomRoot) = 0) then
      Parameters := Parameters + ' --user-data-dir "' + CustomRoot + '"';
    if Exec(ExpandConstant('{tmp}\PikaNav.ExtensionDetector.exe'), Parameters, '', SW_HIDE, ewWaitUntilTerminated, ExitCode) and
       (ExitCode = 0) and LoadStringFromFile(OutputPath, Detected) then
      if ExtensionIdsAreValid(Trim(String(Detected))) then Result := Trim(String(Detected));
  except
    Log('Automatic extension detection unavailable; retaining manual pairing.');
  end;
end;

function StableDefaultId: String;
begin
  Result := '{#StableExtensionId}';
#ifdef InstallerTestMode
  if ExpandConstant('{param:NODEFAULTID|0}') = '1' then Result := '';
#endif
end;

procedure RefreshDetection(Sender: TObject);
var
  Detected, Saved: String;
begin
  DetectAgainButton.Enabled := False;
  DetectStatus.Caption := 'Looking for PikaDesk · 皮卡桌面 in Chrome...';
  WizardForm.Refresh;
  Detected := DetectExtensionIds;
  Saved := GetPreviousData('ExtensionIds', '');
  if not ExtensionIdsAreValid(Saved) then Saved := '';
  if Detected <> '' then begin
    ExtensionPage.Values[0] := MergeExtensionIds(MergeExtensionIds(Detected, '{#DefaultExtensionIds}'), StableDefaultId);
    DetectStatus.Caption := 'PikaDesk · 皮卡桌面 was found in Chrome. Click Next to connect automatically.';
  end else if Saved <> '' then begin
    ExtensionPage.Values[0] := MergeExtensionIds(Saved, StableDefaultId);
    DetectStatus.Caption := 'Your previous PikaDesk · 皮卡桌面 connection was found and will be kept.';
  end else if '{#DefaultExtensionIds}' <> '' then begin
    ExtensionPage.Values[0] := MergeExtensionIds('{#DefaultExtensionIds}', StableDefaultId);
    DetectStatus.Caption := 'This installer already knows your PikaDesk · 皮卡桌面 extension.';
  end else begin
    ExtensionPage.Values[0] := StableDefaultId;
    DetectStatus.Caption := 'Ready for the current PikaDesk · 皮卡桌面 portable release. If you use an older unpacked copy, load it in Chrome and click Detect again.';
  end;
  AutomaticPairing := ExtensionIdsAreValid(ExtensionPage.Values[0]);
  DetectAgainButton.Enabled := True;
end;

procedure InitializeWizard;
begin
  PairingMode := CreateInputOptionPage(wpWelcome, 'Connect PikaDesk · 皮卡桌面',
    'Setup can connect to your PikaDesk · 皮卡桌面 extension automatically.',
    'Choose how to connect:', True, False);
  PairingMode.Add('Connect automatically (recommended)');
  PairingMode.Add('Enter extension IDs manually');
  PairingMode.SelectedValueIndex := 0;
  DetectStatus := TNewStaticText.Create(WizardForm);
  DetectStatus.Parent := PairingMode.Surface;
  DetectStatus.Left := 0;
  DetectStatus.Top := ScaleY(100);
  DetectStatus.Width := PairingMode.SurfaceWidth;
  DetectStatus.Height := ScaleY(60);
  DetectStatus.WordWrap := True;
  DetectAgainButton := TNewButton.Create(WizardForm);
  DetectAgainButton.Parent := PairingMode.Surface;
  DetectAgainButton.Left := 0;
  DetectAgainButton.Top := ScaleY(170);
  DetectAgainButton.Width := ScaleX(120);
  DetectAgainButton.Caption := 'Detect again';
  DetectAgainButton.OnClick := @RefreshDetection;
  ExtensionPage := CreateInputQueryPage(PairingMode.ID,
    'Connect your PikaDesk · 皮卡桌面 extension', 'Pair this helper with PikaDesk · 皮卡桌面 in Chrome.',
    'Open chrome://extensions and turn on Developer mode. Find PikaDesk · 皮卡桌面 and copy its ID, then paste it below. This lets only your selected extension use the helper.');
  ExtensionPage.Add('PikaDesk · 皮卡桌面 extension &ID:', False);
  ExtensionPage.Values[0] := ExpandConstant('{param:EXTENSIONID|}');
  if ExtensionPage.Values[0] <> '' then begin
    PairingMode.SelectedValueIndex := 1;
    AutomaticPairing := False;
    DetectStatus.Caption := 'An explicit extension ID was supplied to Setup.';
  end else RefreshDetection(nil);
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := (PageID = ExtensionPage.ID) and (PairingMode.SelectedValueIndex = 0) and AutomaticPairing;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if (CurPageID = PairingMode.ID) and (PairingMode.SelectedValueIndex = 0) and not AutomaticPairing then begin
    { With no usable automatic result, show the manual fallback. }
    PairingMode.SelectedValueIndex := 1;
  end;
  if CurPageID = ExtensionPage.ID then begin
    Result := ExtensionIdsAreValid(ExtensionPage.Values[0]);
    if not Result then
      SuppressibleMsgBox('Paste the 32 lowercase letters shown as PikaDesk · 皮卡桌面''s ID at chrome://extensions. For multiple PikaDesk · 皮卡桌面 installations, separate their IDs with commas (maximum 10).', mbError, MB_OK, IDOK);
  end;
end;

function JsonEscape(Value: String): String;
begin
  StringChangeEx(Value, '\', '\\', True);
  StringChangeEx(Value, '"', '\"', True);
  Result := Value;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Ids, Lines: TArrayOfString;
  Origins, Manifest: String;
  I: Integer;
begin
  Result := '';
  if not ExtensionIdsAreValid(ExtensionPage.Values[0]) then begin
    Result := 'A valid PikaDesk · 皮卡桌面 extension ID is required. Run Setup again and paste the ID from chrome://extensions.';
    Exit;
  end;
  SplitExtensionIds(ExtensionPage.Values[0], Ids);
  Origins := '';
  for I := 0 to GetArrayLength(Ids) - 1 do begin
    if I > 0 then Origins := Origins + ',';
    Origins := Origins + '"chrome-extension://' + Trim(Ids[I]) + '/"';
  end;
  Manifest := '{"name":"com.pikanav.media","description":"PikaDesk · 皮卡桌面 Windows Companion",' +
    '"path":"' + JsonEscape(ExpandConstant('{app}\PikaNav.MediaHost.exe')) +
    '","type":"stdio","allowed_origins":[' + Origins + ']}';
  SetArrayLength(Lines, 1);
  Lines[0] := Manifest;
  if not SaveStringsToUTF8FileWithoutBOM(ExpandConstant('{tmp}\com.pikanav.media.json'), Lines, False) then
    Result := 'Setup could not prepare the Chrome connection. Check that your temporary folder is writable and try again.';
end;

procedure RegisterPreviousData(PreviousDataKey: Integer);
begin
  SetPreviousData(PreviousDataKey, 'ExtensionIds', ExtensionPage.Values[0]);
end;

procedure RemoveOwnedRegistration(RootKey: Integer);
var
  RegisteredManifest: String;
begin
  { Preserve a registration that another installation has taken over. }
  if RegQueryStringValue(RootKey, '{#HostRegistryKey}', '', RegisteredManifest) and
     (CompareText(RegisteredManifest, ExpandConstant('{app}\com.pikanav.media.json')) = 0) then begin
    RegDeleteValue(RootKey, '{#HostRegistryKey}', '');
    RegDeleteKeyIfEmpty(RootKey, '{#HostRegistryKey}');
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then begin
    RemoveOwnedRegistration(HKCU32);
    RemoveOwnedRegistration(HKCU64);
  end;
end;
