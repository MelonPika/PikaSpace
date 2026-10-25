import { ChangeEvent, DragEvent as ReactDragEvent, FormEvent, KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  CloudRain,
  Download,
  Droplets,
  Globe2,
  Grid2X2,
  HardDrive,
  History,
  ListTodo,
  Image as ImageIconLucide,
  ImageIcon,
  Mic,
  Monitor,
  Moon,
  Music2,
  Newspaper,
  Palette,
  PanelTop,
  Pause,
  Play,
  Plus,
  Puzzle,
  Search,
  Settings,
  Shield,
  SkipBack,
  SkipForward,
  Sparkles,
  Sun,
  Thermometer,
  Trash2,
  Upload,
  Wind,
  X,
  Zap,
} from "lucide-react";
import "./App.css";
import { createDashboardStorage } from "./dashboard-storage.mjs";

declare const chrome: any;

type SearchMode = "web" | "images" | "videos" | "news" | "ai";
type SearchProviderId = "google" | "bing" | "duckduckgo" | "perplexity";
type StatsStatus = "loading" | "ready" | "unavailable";
type SettingsTab = "appearance" | "wallpaper" | "layout" | "widgets" | "language" | "data";
type WidgetId = "clock" | "music" | "system" | "weather" | "notes" | "tasks" | "news";

type WidgetTask = { id: string; title: string; completed: boolean; createdAt: string };
type WidgetEvent = { id: string; title: string; date: string };
type WidgetData = {
  notes: string;
  tasks: WidgetTask[];
  events: WidgetEvent[];
  newsTopic: string;
};

type DashboardNotification = {
  id: string;
  title: string;
  detail: string;
  tone: "task" | "system";
  href?: string;
};

type DashboardOverview = {
  openTaskCount: number;
  notifications: DashboardNotification[];
};

type LocalProfile = {
  displayName: string;
  avatarDataUrl?: string;
  locale: InterfaceLocale;
};

type PikaSettings = {
  themeMode: "dark" | "light" | "auto";
  accentColor: "nebula" | "teal" | "amber" | "rose" | "emerald" | "custom";
  fontSize: number;
  fontFamily: "inter" | "system" | "geist";
  panelOpacity: number;
  interfaceScale: number;
  settingsScale: number;
  wallpaper: "aurora" | "cosmos" | "mountain" | "abstract" | "solid-dark" | "gradient" | "custom";
  wallpaperBlur: number;
  wallpaperDim: number;
  density: "compact" | "comfortable" | "spacious";
  searchPosition: "top" | "center" | "bottom";
  visibility: {
    greeting: boolean;
    bookmarkGroups: boolean;
    widgetStrip: boolean;
    topBarStats: boolean;
    keyboardShortcuts: boolean;
    snapWidgets: boolean;
  };
  widgets: Record<WidgetId, boolean> & { calendar?: boolean };
  language: {
    locale: "en-US" | "en-GB" | "fr-FR" | "de-DE" | "ja-JP" | "zh-CN";
    timeFormat: "12-hour" | "24-hour";
    dateFormat: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
    startOfWeek: "Sunday" | "Monday";
  };
};

type InterfaceLocale = PikaSettings["language"]["locale"];

type StoredData = {
  settings: PikaSettings;
  favorites: Favorite[];
  favoriteGroups?: FavoriteGroup[];
  weatherLocation?: WeatherLocation | null;
  widgetData?: WidgetData;
};

type SystemStats = {
  cpu: number | null;
  ram: number | null;
  disk: number | null;
  gpu: number | null;
  memoryUsedMb?: number | null;
  memoryTotalMb?: number | null;
  diskName?: string;
  diskUsedGb?: number | null;
  diskTotalGb?: number | null;
  gpuNote?: string;
  status: StatsStatus;
  error?: string;
};

type MediaStatus = "loading" | "ready" | "empty" | "unavailable";

type MediaSession = {
  status: MediaStatus;
  hasSession: boolean;
  title: string;
  artist: string;
  album: string;
  sourceAppUserModelId: string;
  playbackStatus: string;
  artworkUrl: string;
  backend?: "browser" | "native";
  target?: { tabId: number; frameId: number; documentId: string };
  capabilities?: { playPause: boolean; previous: boolean; next: boolean };
  requiresBrowserAccess?: boolean;
  error?: string;
  commandPending?: "previous" | "playPause" | "next";
};

type WeatherStatus = "loading" | "ready" | "unavailable";

type WeatherDay = {
  date: string;
  code: number;
  high: number | null;
  low: number | null;
  precipitationChance: number | null;
};

type WeatherLocation = {
  name: string;
  country: string;
  source: "browser" | "manual" | "fallback";
  accuracyMeters: number | null;
  timezone: string;
  latitude: number;
  longitude: number;
};

type WeatherSnapshot = {
  status: WeatherStatus;
  location: string;
  verifiedLocation: WeatherLocation | null;
  temperature: number | null;
  apparentTemperature: number | null;
  humidity: number | null;
  precipitation: number | null;
  windSpeed: number | null;
  code: number | null;
  isDay: boolean;
  unit: "°C";
  windUnit: "km/h";
  updatedAt: string;
  forecast: WeatherDay[];
  error?: string;
};

type Favorite = {
  id?: string;
  groupId?: string;
  label: string;
  url: string;
  accent: string;
  monogram?: string;
  faviconUrl?: string;
};

type FavoriteGroup = {
  id: string;
  label: string;
};

type SuggestionKind = "history" | "search" | "ai";
type SuggestionStatus = "idle" | "loading" | "ready" | "error";

type SearchSuggestion = {
  kind: SuggestionKind;
  text: string;
  detail: string;
};

type SuggestionCacheEntry = {
  suggestions: SearchSuggestion[];
  expiresAt: number;
};

type StorageCategory = {
  label: string;
  bytes: number;
  color: string;
};

type StorageStatus = {
  usedBytes: number;
  quotaBytes: number;
  categories: StorageCategory[];
};

type SettingsPanelProps = {
  settings: PikaSettings;
  favorites: Favorite[];
  favoriteGroups: FavoriteGroup[];
  weatherLocation: WeatherLocation | null;
  widgetData: WidgetData;
  customWallpaperDataUrl: string;
  onClose: () => void;
  onSettingsChange: (next: PikaSettings) => void;
  onFavoritesChange: (items: Favorite[]) => void;
  onFavoriteGroupsChange: (groups: FavoriteGroup[]) => void;
  onCustomWallpaperChange: (dataUrl: string) => void;
  onImportData: (data: Partial<StoredData> & { customWallpaperDataUrl?: string }) => void;
  onResetAll: () => void;
};

type PikaStyle = CSSProperties & {
  "--ui-scale": number;
  "--violet": string;
  "--violet-soft": string;
  "--surface": string;
  "--surface-soft": string;
  "--glass-surface": string;
  "--glass-surface-strong": string;
  "--glass-surface-soft": string;
  "--glass-border": string;
  "--glass-highlight": string;
  "--panel-bg": string;
  "--panel-bg-strong": string;
  "--panel-border": string;
  "--panel-shadow": string;
  "--text-primary": string;
  "--text-secondary": string;
  "--text-disabled": string;
  "--accent": string;
  "--accent-soft": string;
  "--accent-border": string;
  "--accent-text": string;
  "--wallpaper-blur": string;
  "--wallpaper-dim": number;
  "--interface-scale": number;
  "--settings-scale": number;
};

const chromeApi = typeof chrome === "undefined" ? undefined : chrome;
const SYNC_KEY = "pikanav:data";
function reportStorageStatus(message: string) { window.dispatchEvent(new CustomEvent("pikanav:storage-status", { detail: message })); }
let browserStorage: Storage | undefined;
try { browserStorage = window.localStorage; } catch { /* Storage helper handles an unavailable browser store. */ }
const dashboardStorage = createDashboardStorage(chromeApi, browserStorage, reportStorageStatus);
const LOCAL_WALLPAPER_KEY = "pikanav:customWallpaperDataUrl";
const PROFILE_DISPLAY_NAME_KEY = "pikanav.profile.displayName";
const PROFILE_AVATAR_KEY = "pikanav.profile.avatarDataUrl";
const PROFILE_LOCALE_KEY = "pikanav.locale";
const WIDGET_ORDER_KEY = "pikanav.widgetOrder";
const WIDGET_DATA_KEY = "pikanav.widgetData";
const SYNC_WRITE_DEBOUNCE_MS = 800;
const CLOCK_TICK_MS = 1000;
const SYSTEM_STATS_POLL_MS = 5000;
const MEDIA_POLL_ACTIVE_MS = 5000;
const MEDIA_POLL_IDLE_MS = 15000;
const DEFAULT_PROFILE: LocalProfile = { displayName: "Alex", avatarDataUrl: "", locale: "en-US" };
const MAX_AVATAR_BYTES = 2_000_000;
const defaultWidgetData: WidgetData = { notes: "", tasks: [], events: [], newsTopic: "technology" };
const accentThemes = {
  nebula: { label: "Nebula", color: "#8b5cf6", soft: "#c4b5fd", lightText: "#6d28d9" },
  teal: { label: "Teal", color: "#14b8a6", soft: "#99f6e4", lightText: "#0f766e" },
  amber: { label: "Amber", color: "#f59e0b", soft: "#fde68a", lightText: "#b45309" },
  rose: { label: "Rose", color: "#f43f5e", soft: "#fda4af", lightText: "#be123c" },
  emerald: { label: "Emerald", color: "#10b981", soft: "#a7f3d0", lightText: "#047857" },
  custom: { label: "Custom", color: "#d946ef", soft: "#f0abfc", lightText: "#a21caf" },
} satisfies Record<PikaSettings["accentColor"], { label: string; color: string; soft: string; lightText: string }>;

const defaultSettings: PikaSettings = {
  themeMode: "dark",
  accentColor: "nebula",
  fontSize: 16,
  fontFamily: "inter",
  panelOpacity: 88,
  interfaceScale: 100,
  settingsScale: 92,
  wallpaper: "aurora",
  wallpaperBlur: 0,
  wallpaperDim: 40,
  density: "comfortable",
  searchPosition: "center",
  visibility: {
    greeting: true,
    bookmarkGroups: true,
    widgetStrip: true,
    topBarStats: true,
    keyboardShortcuts: false,
    snapWidgets: false,
  },
  widgets: {
    clock: true,
    music: true,
    system: true,
    weather: false,
    notes: false,
    tasks: false,
    calendar: false,
    news: false,
  },
  language: {
    locale: "en-US",
    timeFormat: "12-hour",
    dateFormat: "MM/DD/YYYY",
    startOfWeek: "Sunday",
  },
};

const defaultFavorites: Favorite[] = [
  { id: "fav-github", groupId: "pinned", label: "GitHub", url: "https://github.com", accent: "#a78bfa" },
  { id: "fav-figma", groupId: "pinned", label: "Figma", url: "https://figma.com", monogram: "Fi", accent: "#f472b6" },
  { id: "fav-linear", groupId: "pinned", label: "Linear", url: "https://linear.app", monogram: "L", accent: "#818cf8" },
  { id: "fav-notion", groupId: "pinned", label: "Notion", url: "https://notion.so", monogram: "N", accent: "#cbd5e1" },
  { id: "fav-vercel", groupId: "dev", label: "Vercel", url: "https://vercel.com", monogram: "V", accent: "#f8fafc" },
  { id: "fav-raycast", groupId: "dev", label: "Raycast", url: "https://raycast.com", monogram: "R", accent: "#fb7185" },
  { id: "fav-supabase", groupId: "dev", label: "Supabase", url: "https://supabase.com", monogram: "S", accent: "#34d399" },
  { id: "fav-tailwind", groupId: "reading", label: "Tailwind", url: "https://tailwindcss.com", monogram: "Tw", accent: "#22d3ee" },
];

const defaultFavoriteGroups: FavoriteGroup[] = [
  { id: "pinned", label: "Pinned" },
  { id: "dev", label: "Dev" },
  { id: "reading", label: "Reading" },
];

const searchModes = [
  { id: "web", labelKey: "searchWeb" },
  { id: "images", labelKey: "searchImages" },
  { id: "videos", labelKey: "searchVideos" },
  { id: "news", labelKey: "searchNews" },
  { id: "ai", labelKey: "searchAi" },
] satisfies { id: SearchMode; labelKey: TranslationKey }[];

const translations = {
  en: {
    focus: "Focus",
    focusOn: "Focus on",
    notifications: "Notifications",
    settings: "Settings",
    profileSettings: "Profile Settings",
    systemStatsLoading: "System stats loading",
    systemStatsOffline: "System stats offline",
    systemStatsTitle: "System stats from native companion",
    searchMode: "Search mode",
    searchPlaceholder: (provider: string) => `Search ${provider} or enter a URL`,
    voiceSearch: "Voice search",
    imageSearch: "Image search",
    submitSearch: "Submit search",
    shortcutSearch: "Search",
    shortcutNavigate: "Navigate",
    shortcutCloseMenus: "Close menus",
    quickActions: "Quick actions",
    launcher: "Launcher",
    favorites: "Favorites",
    favoriteGroups: "Favorite groups",
    add: "Add",
    today: "Today",
    music: "Music",
    loading: "Loading",
    offline: "Offline",
    live: "Live",
    mediaUnavailable: "Media unavailable",
    noActiveMedia: "No active media",
    untitledTrack: "Untitled track",
    unknownSource: "Unknown source",
    startPlayback: "Start playback in a Chrome tab or Windows media app",
    windowsMediaSession: "Windows media session",
    waitingMedia: "Waiting for playback. Desktop apps need the Windows companion.",
    previousTrack: "Previous track",
    play: "Play",
    pause: "Pause",
    nextTrack: "Next track",
    system: "System",
    memoryUnavailable: "Memory details unavailable",
    connectingCompanion: "Connecting to native companion...",
    nativeStatsUnavailable: "Native system stats are unavailable.",
    dashboardWidgets: "Dashboard widgets",
    soon: "Soon",
    todoConnectWidget: "TODO: connect this widget source.",
    meetings: "3 meetings",
    messages: "7 messages",
    localProfile: "Local profile",
    closeProfileSettings: "Close profile settings",
    uploadAvatar: "Upload avatar",
    removeAvatar: "Remove avatar",
    displayName: "Display name",
    language: "Language",
    english: "English",
    chineseSimplified: "Chinese Simplified",
    cancel: "Cancel",
    save: "Save",
    avatarImageError: "Choose an image file for your avatar.",
    avatarSizeError: "Choose an image smaller than 2 MB.",
    avatarReadError: "That image could not be read.",
  },
  "zh-CN": {
    focus: "专注",
    focusOn: "专注中",
    notifications: "通知",
    settings: "设置",
    profileSettings: "个人资料设置",
    systemStatsLoading: "系统状态加载中",
    systemStatsOffline: "系统状态离线",
    systemStatsTitle: "来自本地助手的系统状态",
    searchMode: "搜索模式",
    searchPlaceholder: (provider: string) => `搜索 ${provider} 或输入网址`,
    voiceSearch: "语音搜索",
    imageSearch: "图片搜索",
    submitSearch: "提交搜索",
    shortcutSearch: "搜索",
    shortcutNavigate: "切换",
    shortcutCloseMenus: "关闭菜单",
    quickActions: "快捷操作",
    launcher: "启动器",
    favorites: "收藏",
    favoriteGroups: "收藏分组",
    add: "添加",
    today: "今天",
    music: "音乐",
    loading: "加载中",
    offline: "离线",
    live: "实时",
    mediaUnavailable: "媒体不可用",
    noActiveMedia: "没有播放中的媒体",
    untitledTrack: "未命名曲目",
    unknownSource: "未知来源",
    startPlayback: "请先在 Chrome 标签页或 Windows 媒体应用中播放",
    windowsMediaSession: "Windows 媒体会话",
    waitingMedia: "正在等待播放。桌面应用需要 Windows 本地助手。",
    previousTrack: "上一首",
    play: "播放",
    pause: "暂停",
    nextTrack: "下一首",
    system: "系统",
    memoryUnavailable: "内存详情不可用",
    connectingCompanion: "正在连接本地助手...",
    nativeStatsUnavailable: "本地系统状态不可用。",
    dashboardWidgets: "仪表盘组件",
    soon: "即将推出",
    todoConnectWidget: "待接入此组件数据源。",
    meetings: "3 个会议",
    messages: "7 条消息",
    localProfile: "本地资料",
    closeProfileSettings: "关闭个人资料设置",
    uploadAvatar: "上传头像",
    removeAvatar: "移除头像",
    displayName: "显示名称",
    language: "语言",
    english: "英语",
    chineseSimplified: "简体中文",
    cancel: "取消",
    save: "保存",
    avatarImageError: "请选择图片文件作为头像。",
    avatarSizeError: "请选择小于 2 MB 的图片。",
    avatarReadError: "无法读取该图片。",
  },
} as const;

const enUi = {
  focus: "Focus",
  focusOn: "Focus on",
  notifications: "Notifications",
  settings: "Settings",
  profileSettings: "Profile Settings",
  systemStatsLoading: "System stats loading",
  systemStatsOffline: "System stats offline",
  systemStatsTitle: "System stats from native companion",
  searchMode: "Search mode",
  searchWeb: "Web",
  searchImages: "Images",
  searchVideos: "Videos",
  searchNews: "News",
  searchAi: "AI",
  searchPlaceholder: (provider: string) => `Search ${provider} or enter a URL`,
  voiceSearch: "Voice search",
  imageSearch: "Image search",
  submitSearch: "Submit search",
  shortcutSearch: "Search",
  shortcutNavigate: "Navigate",
  shortcutCloseMenus: "Close menus",
  quickActions: "Quick actions",
  launcher: "Launcher",
  favorites: "Favorites",
  favoriteGroups: "Favorite groups",
  add: "Add",
  today: "Today",
  music: "Music",
  loading: "Loading",
  offline: "Offline",
  live: "Live",
  mediaUnavailable: "Media unavailable",
  noActiveMedia: "No active media",
  untitledTrack: "Untitled track",
  unknownSource: "Unknown source",
  startPlayback: "Start playback in a Chrome tab or Windows media app",
  windowsMediaSession: "Windows media session",
  waitingMedia: "Waiting for playback. Desktop apps need the Windows companion.",
  browserMediaAccess: "Enable site access to read and control audio or video in Chrome tabs.",
  enableBrowserMedia: "Enable browser media",
  browserMediaDeclined: "Site access was declined. You can enable it whenever you are ready.",
  chromeTab: "Chrome tab",
  previousTrack: "Previous track",
  play: "Play",
  pause: "Pause",
  nextTrack: "Next track",
  system: "System",
  memoryUnavailable: "Memory details unavailable",
  connectingCompanion: "Connecting to native companion...",
  nativeStatsUnavailable: "Native system stats are unavailable.",
  dashboardWidgets: "Dashboard widgets",
  soon: "Soon",
  todoConnectWidget: "TODO: connect this widget source.",
  meetings: "3 meetings",
  messages: "7 messages",
  localProfile: "Local profile",
  closeProfileSettings: "Close profile settings",
  uploadAvatar: "Upload avatar",
  removeAvatar: "Remove avatar",
  displayName: "Display name",
  language: "Language",
  english: "English",
  chineseSimplified: "Chinese Simplified",
  cancel: "Cancel",
  save: "Save",
  avatarImageError: "Choose an image file for your avatar.",
  avatarSizeError: "Choose an image smaller than 2 MB.",
  avatarReadError: "That image could not be read.",
  tabAppearance: "Appearance",
  tabWallpaper: "Wallpaper",
  tabLayout: "Layout",
  tabWidgets: "Widgets",
  tabLanguage: "Language",
  tabData: "Data & Backup",
  appearanceTitle: "Appearance",
  appearanceSubtitle: "Customize colors, typography, and theme mode.",
  wallpaperTitle: "Wallpaper",
  wallpaperSubtitle: "Choose a background for your dashboard.",
  layoutTitle: "Layout",
  layoutSubtitle: "Configure density, grid, and element placement.",
  widgetsTitle: "Widgets",
  widgetsSubtitle: "Enable, disable, and configure your widgets.",
  languageTitle: "Language & Region",
  languageSubtitle: "Interface language, time format, and locale.",
  dataTitle: "Data & Backup",
  dataSubtitle: "Export, import, and reset your configuration.",
  themeMode: "Theme mode",
  accentColor: "Accent color",
  typography: "Typography",
  widgetStyle: "Widget style",
  density: "Density",
  searchBarPosition: "Search bar position",
  panelVisibility: "Panel visibility",
  bookmarkManagement: "Bookmark management",
  interfaceLanguage: "Interface language",
  regionalFormats: "Regional formats",
  sync: "Sync",
  exportImport: "Export & Import",
  storage: "Storage",
  dangerZone: "Danger zone",
  showGreeting: "Show greeting message",
  showBookmarks: "Show bookmark groups",
  showWidgetStrip: "Show widget strip",
  showTopStats: "Show top bar stats",
  snapGrid: "Snap widgets to grid",
  showShortcuts: "Show keyboard shortcuts",
  baseFontSize: "Base font size",
  fontFamily: "Font family",
  panelOpacity: "Panel opacity",
  settingsSize: "Settings size",
  interfaceZoom: "Interface zoom",
} as const;

const uiText = {
  "en-US": enUi,
  "en-GB": enUi,
  "fr-FR": {
    ...enUi,
    focus: "Concentration",
    focusOn: "Concentration active",
    settings: "Parametres",
    searchNews: "Actualites",
    searchAi: "IA",
    searchPlaceholder: (provider: string) => `Rechercher sur ${provider} ou entrer une URL`,
    favorites: "Favoris",
    favoriteGroups: "Groupes de favoris",
    add: "Ajouter",
    today: "Aujourd'hui",
    language: "Langue",
    cancel: "Annuler",
    save: "Enregistrer",
    tabAppearance: "Apparence",
    tabWallpaper: "Fond d'ecran",
    tabLayout: "Disposition",
    tabWidgets: "Widgets",
    tabLanguage: "Langue",
    tabData: "Donnees",
    appearanceTitle: "Apparence",
    wallpaperTitle: "Fond d'ecran",
    layoutTitle: "Disposition",
    widgetsTitle: "Widgets",
    languageTitle: "Langue et region",
    dataTitle: "Donnees",
    themeMode: "Mode du theme",
    accentColor: "Couleur d'accent",
    typography: "Typographie",
    widgetStyle: "Style des widgets",
    density: "Densite",
    searchBarPosition: "Position de la recherche",
    panelVisibility: "Visibilite",
    bookmarkManagement: "Gestion des favoris",
    interfaceLanguage: "Langue de l'interface",
    regionalFormats: "Formats regionaux",
  },
  "de-DE": {
    ...enUi,
    focus: "Fokus",
    focusOn: "Fokus aktiv",
    settings: "Einstellungen",
    searchImages: "Bilder",
    searchAi: "KI",
    searchPlaceholder: (provider: string) => `${provider} durchsuchen oder URL eingeben`,
    favorites: "Favoriten",
    favoriteGroups: "Favoritengruppen",
    add: "Hinzufugen",
    today: "Heute",
    language: "Sprache",
    cancel: "Abbrechen",
    save: "Speichern",
    tabAppearance: "Darstellung",
    tabWallpaper: "Hintergrund",
    tabLayout: "Layout",
    tabWidgets: "Widgets",
    tabLanguage: "Sprache",
    tabData: "Daten",
    appearanceTitle: "Darstellung",
    wallpaperTitle: "Hintergrund",
    layoutTitle: "Layout",
    widgetsTitle: "Widgets",
    languageTitle: "Sprache und Region",
    dataTitle: "Daten",
    themeMode: "Theme-Modus",
    accentColor: "Akzentfarbe",
    typography: "Typografie",
    widgetStyle: "Widget-Stil",
    density: "Dichte",
    searchBarPosition: "Suchleistenposition",
    panelVisibility: "Sichtbarkeit",
    bookmarkManagement: "Favoriten verwalten",
    interfaceLanguage: "Oberflachensprache",
    regionalFormats: "Regionale Formate",
  },
  "ja-JP": {
    ...enUi,
    focus: "フォーカス",
    focusOn: "フォーカス中",
    settings: "設定",
    searchWeb: "ウェブ",
    searchImages: "画像",
    searchVideos: "動画",
    searchNews: "ニュース",
    searchPlaceholder: (provider: string) => `${provider} で検索、またはURLを入力`,
    favorites: "お気に入り",
    favoriteGroups: "お気に入りグループ",
    add: "追加",
    today: "今日",
    language: "言語",
    cancel: "キャンセル",
    save: "保存",
    tabAppearance: "外観",
    tabWallpaper: "壁紙",
    tabLayout: "レイアウト",
    tabWidgets: "ウィジェット",
    tabLanguage: "言語",
    tabData: "データ",
    appearanceTitle: "外観",
    wallpaperTitle: "壁紙",
    layoutTitle: "レイアウト",
    widgetsTitle: "ウィジェット",
    languageTitle: "言語と地域",
    dataTitle: "データ",
    themeMode: "テーマ",
    accentColor: "アクセント色",
    typography: "文字",
    widgetStyle: "ウィジェット設定",
    density: "密度",
    searchBarPosition: "検索バー位置",
    panelVisibility: "表示",
    bookmarkManagement: "ブックマーク管理",
    interfaceLanguage: "表示言語",
    regionalFormats: "地域形式",
  },
  "zh-CN": {
    ...enUi,
    startPlayback: "请先在 Chrome 标签页或 Windows 媒体应用中播放",
    waitingMedia: "正在等待播放。桌面应用需要 Windows 本地助手。",
    browserMediaAccess: "启用网站访问权限以读取和控制 Chrome 标签页中的音频或视频。",
    enableBrowserMedia: "启用浏览器媒体",
    browserMediaDeclined: "网站访问权限未获批准。您可以随时重新启用。",
    chromeTab: "Chrome 标签页",
    focus: "专注",
    focusOn: "专注中",
    notifications: "通知",
    settings: "设置",
    profileSettings: "个人资料设置",
    systemStatsLoading: "系统状态加载中",
    systemStatsOffline: "系统状态离线",
    systemStatsTitle: "来自本地助手的系统状态",
    searchMode: "搜索模式",
    searchWeb: "网页",
    searchImages: "图片",
    searchVideos: "视频",
    searchNews: "新闻",
    searchPlaceholder: (provider: string) => `搜索 ${provider} 或输入网址`,
    voiceSearch: "语音搜索",
    imageSearch: "图片搜索",
    submitSearch: "提交搜索",
    shortcutSearch: "搜索",
    shortcutNavigate: "切换",
    shortcutCloseMenus: "关闭菜单",
    quickActions: "快捷操作",
    launcher: "启动器",
    favorites: "收藏",
    favoriteGroups: "收藏分组",
    add: "添加",
    today: "今天",
    music: "音乐",
    loading: "加载中",
    offline: "离线",
    live: "实时",
    system: "系统",
    dashboardWidgets: "仪表盘组件",
    localProfile: "本地资料",
    closeProfileSettings: "关闭个人资料设置",
    uploadAvatar: "上传头像",
    removeAvatar: "移除头像",
    displayName: "显示名称",
    language: "语言",
    english: "英语",
    chineseSimplified: "简体中文",
    cancel: "取消",
    save: "保存",
    tabAppearance: "外观",
    tabWallpaper: "壁纸",
    tabLayout: "布局",
    tabWidgets: "小组件",
    tabLanguage: "语言",
    tabData: "数据与备份",
    appearanceTitle: "外观",
    appearanceSubtitle: "自定义颜色、字体和主题模式。",
    wallpaperTitle: "壁纸",
    wallpaperSubtitle: "选择仪表盘背景。",
    layoutTitle: "布局",
    layoutSubtitle: "配置密度、网格和元素位置。",
    widgetsTitle: "小组件",
    widgetsSubtitle: "启用、禁用和配置小组件。",
    languageTitle: "语言与地区",
    languageSubtitle: "界面语言、时间格式和区域设置。",
    dataTitle: "数据与备份",
    dataSubtitle: "导出、导入和重置配置。",
    themeMode: "主题模式",
    accentColor: "强调色",
    typography: "字体",
    widgetStyle: "小组件样式",
    density: "密度",
    searchBarPosition: "搜索栏位置",
    panelVisibility: "面板显示",
    bookmarkManagement: "书签管理",
    interfaceLanguage: "界面语言",
    regionalFormats: "区域格式",
    sync: "同步",
    exportImport: "导出与导入",
    storage: "存储",
    dangerZone: "危险区域",
    showGreeting: "显示问候语",
    showBookmarks: "显示书签分组",
    showWidgetStrip: "显示小组件栏",
    showTopStats: "显示顶部系统状态",
    snapGrid: "小组件吸附网格",
    showShortcuts: "显示快捷键提示",
    baseFontSize: "基础字号",
    fontFamily: "字体",
    panelOpacity: "面板透明度",
    settingsSize: "设置窗口大小",
  },
} as const;

type TranslationKey = keyof typeof enUi;

function normalizeInterfaceLocale(locale: unknown): InterfaceLocale {
  return ["en-US", "en-GB", "fr-FR", "de-DE", "ja-JP", "zh-CN"].includes(String(locale)) ? locale as InterfaceLocale : "en-US";
}

function t<K extends TranslationKey>(locale: InterfaceLocale | LocalProfile["locale"], key: K): typeof enUi[K] {
  return uiText[normalizeInterfaceLocale(locale)][key] as typeof enUi[K];
}

function widgetLabel(widget: { id: WidgetId; label: string }, locale: InterfaceLocale | LocalProfile["locale"]) {
  const labels: Record<WidgetId, string> = normalizeInterfaceLocale(locale) === "zh-CN"
    ? { clock: "时钟与日期", music: "音乐播放器", system: "系统监控", weather: "天气", notes: "快速笔记", tasks: "任务列表", news: "新闻" }
    : { clock: "Clock & Date", music: "Music Player", system: "System Monitor", weather: "Weather", notes: "Quick Notes", tasks: "Task List", news: "News Feed" };
  return labels[widget.id] || widget.label;
}

function widgetDescription(widget: { id: WidgetId; description: string }, locale: InterfaceLocale | LocalProfile["locale"]) {
  const normalized = normalizeInterfaceLocale(locale);
  const descriptions: Partial<Record<InterfaceLocale, Record<WidgetId, string>>> = {
    "zh-CN": {
      clock: "支持时区的数字时钟",
      music: "Windows 媒体播放器状态",
      system: "CPU、内存、磁盘和 GPU 状态",
      weather: "当前天气与 5 日预报",
      notes: "快速便签和提醒",
      tasks: "集成任务清单",
      news: "按主题精选文章",
    },
    "ja-JP": {
      clock: "タイムゾーン対応のデジタル時計",
      music: "Windows メディアの再生状態",
      system: "CPU、メモリ、ディスク、GPU の状態",
      weather: "現在の天気と5日予報",
      notes: "クイックメモとリマインダー",
      tasks: "統合タスクリスト",
      news: "トピック別ニュース",
    },
    "fr-FR": {
      clock: "Horloge numerique avec fuseaux horaires",
      music: "Etat du lecteur media Windows",
      system: "CPU, RAM, disque et GPU",
      weather: "Conditions actuelles et previsions",
      notes: "Notes rapides et rappels",
      tasks: "Liste de taches integree",
      news: "Articles selectionnes par sujet",
    },
    "de-DE": {
      clock: "Digitale Uhr mit Zeitzonen",
      music: "Windows-Medienstatus",
      system: "CPU, RAM, Datentrager und GPU",
      weather: "Aktuelles Wetter und Vorhersage",
      notes: "Kurznotizen und Erinnerungen",
      tasks: "Integrierte Aufgabenliste",
      news: "Kuratierte Artikel nach Thema",
    },
  };
  return descriptions[normalized]?.[widget.id] || widget.description;
}

const searchProviders: Record<SearchProviderId, { label: string; short: string; iconUrl: string; buildUrl: (query: string, mode: SearchMode) => string }> = {
  google: {
    label: "Google",
    short: "G",
    iconUrl: "https://www.google.com/favicon.ico",
    buildUrl: (query, mode) => {
      const modeParams: Record<SearchMode, string> = { web: "", images: "&tbm=isch", videos: "&tbm=vid", news: "&tbm=nws", ai: "&udm=50" };
      return `https://www.google.com/search?q=${encodeURIComponent(query)}${modeParams[mode]}`;
    },
  },
  bing: {
    label: "Bing",
    short: "B",
    iconUrl: "https://www.bing.com/favicon.ico",
    buildUrl: (query, mode) => {
      const modeParams: Record<SearchMode, string> = { web: "", images: "&scope=images", videos: "&scope=video", news: "&scope=news", ai: "" };
      return `https://www.bing.com/search?q=${encodeURIComponent(query)}${modeParams[mode]}`;
    },
  },
  duckduckgo: {
    label: "DuckDuckGo",
    short: "D",
    iconUrl: "https://duckduckgo.com/favicon.ico",
    buildUrl: (query, mode) => {
      const modeParams: Record<SearchMode, string> = { web: "", images: "&iax=images&ia=images", videos: "&iax=videos&ia=videos", news: "&iar=news&ia=news", ai: "" };
      return `https://duckduckgo.com/?q=${encodeURIComponent(query)}${modeParams[mode]}`;
    },
  },
  perplexity: {
    label: "Perplexity",
    short: "P",
    iconUrl: "https://www.perplexity.ai/favicon.ico",
    buildUrl: (query) => `https://www.perplexity.ai/search?q=${encodeURIComponent(query)}`,
  },
};

const searchModeLabels: Record<SearchMode, string> = {
  web: "Web",
  images: "Images",
  videos: "Videos",
  news: "News",
  ai: "AI",
};

const SUGGESTION_CACHE_MS = 90_000;
const SUGGESTION_DEBOUNCE_MS = 180;
const MIN_SUGGESTION_QUERY_LENGTH = 2;

const quickActions = [
  { label: "New Tab", icon: PanelTop, action: "newtab" },
  { label: "Downloads", icon: Download, action: "downloads" },
  { label: "Translate", icon: Globe2, action: "translate" },
  { label: "Focus", icon: Zap, action: "focus" },
  { label: "History", icon: History, action: "history" },
] as const;

const settingsTabs: { id: SettingsTab; label: string; icon: typeof Palette }[] = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "wallpaper", label: "Wallpaper", icon: ImageIconLucide },
  { id: "layout", label: "Layout", icon: Grid2X2 },
  { id: "widgets", label: "Widgets", icon: Puzzle },
  { id: "language", label: "Language", icon: Globe2 },
  { id: "data", label: "Data & Backup", icon: Download },
];

  const settingsTabLabelKeys: Record<SettingsTab, Exclude<TranslationKey, "searchPlaceholder">> = {
  appearance: "tabAppearance",
  wallpaper: "tabWallpaper",
  layout: "tabLayout",
  widgets: "tabWidgets",
  language: "tabLanguage",
  data: "tabData",
};

const languages = [
  { code: "en-US", label: "English (US)", native: "English" },
  { code: "en-GB", label: "English (UK)", native: "English" },
  { code: "fr-FR", label: "French", native: "Français" },
  { code: "de-DE", label: "German", native: "Deutsch" },
  { code: "ja-JP", label: "Japanese", native: "日本語" },
  { code: "zh-CN", label: "Chinese (Simplified)", native: "中文" },
] as const;

const cleanLanguageNativeNames: Record<InterfaceLocale, string> = {
  "en-US": "English",
  "en-GB": "English",
  "fr-FR": "Francais",
  "de-DE": "Deutsch",
  "ja-JP": "日本語",
  "zh-CN": "中文",
};

const widgetConfig = [
  { id: "clock", label: "Clock & Date", description: "Digital clock with timezone support" },
  { id: "music", label: "Music Player", description: "Spotify, Apple Music, or local player" },
  { id: "system", label: "System Monitor", description: "CPU, RAM, disk, GPU stats" },
  { id: "weather", label: "Weather", description: "Current conditions and 5-day forecast" },
  { id: "notes", label: "Quick Notes", description: "Sticky notes and reminders" },
  { id: "tasks", label: "Task List", description: "Integrated to-do list" },
  { id: "news", label: "News Feed", description: "Curated articles by topic" },
] as const;

const defaultWidgetOrder = widgetConfig.map((widget) => widget.id) as WidgetId[];

function loadWidgetOrder(): WidgetId[] {
  try {
    const stored = JSON.parse(localStorage.getItem(WIDGET_ORDER_KEY) || "[]");
    const known = new Set(defaultWidgetOrder);
    const ordered = Array.isArray(stored) ? [...new Set(stored.filter((id): id is WidgetId => known.has(id)))] : [];
    return [...ordered, ...defaultWidgetOrder.filter((id) => !ordered.includes(id))];
  } catch {
    return defaultWidgetOrder;
  }
}

function saveWidgetOrder(order: WidgetId[]) {
  try {
    localStorage.setItem(WIDGET_ORDER_KEY, JSON.stringify(order));
  } catch (error) {
    reportStorageStatus("Widget order could not be saved on this device.");
  }
}

function moveWidget(order: WidgetId[], sourceId: WidgetId, targetId: WidgetId) {
  if (sourceId === targetId) return order;
  const next = [...order];
  const sourceIndex = next.indexOf(sourceId);
  const targetIndex = next.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0) return order;
  const [item] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, item);
  return next;
}

function useWidgetData() {
  const [data, setDataState] = useState<WidgetData>(defaultWidgetData);
  const [loaded, setLoaded] = useState(false);
  const lastWritten = useRef("");

  useEffect(() => {
    let mounted = true;
    const finish = (value: unknown) => {
      if (!mounted) return;
      const next = normalizeWidgetData(value);
      lastWritten.current = JSON.stringify(next);
      setDataState(next);
      setLoaded(true);
    };
    if (chromeApi?.storage?.local) {
      void dashboardStorage.read(WIDGET_DATA_KEY).then(finish).catch(() => reportStorageStatus("Widget data could not be read. Reload to retry; existing data has been kept."));
    } else {
      try {
        finish(JSON.parse(localStorage.getItem(WIDGET_DATA_KEY) || "{}"));
      } catch {
        finish({});
      }
    }
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const serialized = JSON.stringify(data);
    if (lastWritten.current === serialized) return;
    lastWritten.current = serialized;
    if (chromeApi?.storage?.local) {
      void dashboardStorage.write(WIDGET_DATA_KEY, data).catch(() => undefined);
    } else {
      try { localStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(data)); } catch { reportStorageStatus("Widget changes could not be saved. Export a backup before closing this tab."); }
    }
  }, [data, loaded]);

  useEffect(() => {
    const update = (changes: Record<string, any>, area: string) => {
      if (area !== "local" || !changes[WIDGET_DATA_KEY]?.newValue) return;
      const next = normalizeWidgetData(changes[WIDGET_DATA_KEY].newValue);
      const serialized = JSON.stringify(next);
      if (serialized === lastWritten.current) return;
      lastWritten.current = serialized;
      setDataState(next);
    };
    chromeApi?.storage?.onChanged?.addListener(update);
    return () => chromeApi?.storage?.onChanged?.removeListener(update);
  }, []);

  const setData = useCallback((next: WidgetData) => setDataState(normalizeWidgetData(next)), []);
  return { widgetData: data, setWidgetData: setData };
}
function mergeSettings(value: unknown): PikaSettings {
  const record = (item: unknown): Record<string, any> => item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, any> : {};
  const incoming = record(value);
  const next = structuredClone(defaultSettings);
  const choices = {
    themeMode: ["dark", "light", "auto"], accentColor: Object.keys(accentThemes),
    fontFamily: ["inter", "system", "geist"], wallpaper: ["aurora", "cosmos", "mountain", "abstract", "solid-dark", "gradient", "custom"],
    density: ["compact", "comfortable", "spacious"], searchPosition: ["top", "center", "bottom"],
  };
  for (const [key, values] of Object.entries(choices)) {
    if (values.includes(incoming[key])) (next as any)[key] = incoming[key];
  }
  const ranges = { fontSize: [12, 20], panelOpacity: [40, 100], interfaceScale: [80, 130], settingsScale: [80, 110], wallpaperBlur: [0, 20], wallpaperDim: [0, 90] };
  for (const [key, [min, max]] of Object.entries(ranges)) {
    const number = incoming[key];
    if (typeof number === "number" && Number.isFinite(number)) (next as any)[key] = Math.min(max, Math.max(min, number));
  }
  for (const group of ["visibility", "widgets"] as const) {
    const source = record(incoming[group]);
    for (const key of Object.keys(next[group])) {
      if (typeof source[key] === "boolean") (next[group] as any)[key] = source[key];
    }
  }
  const language = record(incoming.language);
  for (const [key, values] of Object.entries({ locale: ["en-US", "en-GB", "fr-FR", "de-DE", "ja-JP", "zh-CN"], timeFormat: ["12-hour", "24-hour"], dateFormat: ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"], startOfWeek: ["Sunday", "Monday"] })) {
    if (values.includes(language[key])) (next.language as any)[key] = language[key];
  }
  return next;
}

function safeImageData(value: unknown): string {
  return typeof value === "string" && value.length <= 4_000_000 && /^data:image\/(png|jpe?g|webp|gif|avif|svg\+xml|bmp|x-icon|vnd\.microsoft\.icon);base64,/i.test(value) ? value : "";
}

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeFavorite(favorite: Favorite, index = 0, fallbackGroupId = "pinned"): Favorite {
  const label = typeof favorite.label === "string" ? favorite.label.trim().slice(0, 160) || "Untitled" : "Untitled";
  const url = normalizeUrl(typeof favorite.url === "string" ? favorite.url : "");
  return {
    ...favorite,
    id: typeof favorite.id === "string" ? favorite.id : createId(`favorite-${index}`),
    groupId: typeof favorite.groupId === "string" ? favorite.groupId : fallbackGroupId,
    label,
    url,
    faviconUrl: getFavoriteFaviconUrl(url),
    monogram: typeof favorite.monogram === "string" ? favorite.monogram.slice(0, 4) : label.slice(0, 2).toUpperCase(),
    accent: typeof favorite.accent === "string" && /^#[0-9a-f]{3,8}$/i.test(favorite.accent) ? favorite.accent : "#a78bfa",
  };
}

function normalizeFavoriteGroups(value: unknown): FavoriteGroup[] {
  const source = Array.isArray(value) ? value : defaultFavoriteGroups;
  const groups = source
    .map((group, index) => {
      if (!group || typeof group !== "object") return null;
      const item = group as Partial<FavoriteGroup>;
      const label = typeof item.label === "string" ? item.label.trim().slice(0, 160) || `Group ${index + 1}` : `Group ${index + 1}`;
      return { id: typeof item.id === "string" ? item.id : createId("group"), label };
    })
    .filter((group): group is FavoriteGroup => Boolean(group));
  return groups.length ? groups.filter((group, index) => groups.findIndex((item) => item.id === group.id) === index) : defaultFavoriteGroups;
}

function normalizeFavorites(value: unknown, groups: FavoriteGroup[]): Favorite[] {
  const fallbackGroupId = groups[0]?.id || "pinned";
  const source = Array.isArray(value) ? value : defaultFavorites;
  const knownGroups = new Set(groups.map((group) => group.id));
  const knownIds = new Set<string>();
  return source.filter((item) => item && typeof item === "object" && typeof item.url === "string" && Boolean(normalizeUrl(item.url))).map((favorite, index) => {
    const normalized = normalizeFavorite(favorite as Favorite, index, fallbackGroupId);
    if (knownIds.has(normalized.id!)) normalized.id = createId("favorite");
    knownIds.add(normalized.id!);
    return knownGroups.has(normalized.groupId || "") ? normalized : { ...normalized, groupId: fallbackGroupId };
  });
}

function normalizeWeatherLocation(value: unknown): WeatherLocation | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<WeatherLocation>;
  const latitude = Number(item.latitude);
  const longitude = Number(item.longitude);
  if (item.latitude == null || item.longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return {
    name: typeof item.name === "string" ? item.name.trim() || "Selected location" : "Selected location",
    country: typeof item.country === "string" ? item.country.trim() : "",
    source: item.source === "browser" || item.source === "fallback" ? item.source : "manual",
    accuracyMeters: Number.isFinite(Number(item.accuracyMeters)) ? Number(item.accuracyMeters) : null,
    timezone: typeof item.timezone === "string" ? item.timezone : "auto",
    latitude,
    longitude,
  };
}

function normalizeWidgetData(value: unknown): WidgetData {
  const incoming = value && typeof value === "object" ? value as Partial<WidgetData> : {};
  const tasks = Array.isArray(incoming.tasks) ? incoming.tasks.slice(0, 100).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const task = item as Partial<WidgetTask>;
    const title = String(task.title || "").trim().slice(0, 160);
    return title ? [{ id: String(task.id || createId("task")), title, completed: Boolean(task.completed), createdAt: String(task.createdAt || new Date().toISOString()) }] : [];
  }) : [];
  const events = Array.isArray(incoming.events) ? incoming.events.slice(0, 100).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const calendarEvent = item as Partial<WidgetEvent>;
    const title = String(calendarEvent.title || "").trim().slice(0, 160);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(calendarEvent.date || "")) ? String(calendarEvent.date) : "";
    return title && date ? [{ id: String(calendarEvent.id || createId("event")), title, date }] : [];
  }) : [];
  return {
    notes: String(incoming.notes || "").slice(0, 4000),
    tasks,
    events,
    newsTopic: String(incoming.newsTopic || defaultWidgetData.newsTopic).slice(0, 50),
  };
}
async function getSyncData(): Promise<Partial<StoredData>> {
  return dashboardStorage.loadDashboard();
}
async function getLocalWallpaper(): Promise<string> {
  return (await dashboardStorage.read(LOCAL_WALLPAPER_KEY)) || "";
}
async function setLocalWallpaper(dataUrl: string): Promise<void> {
  try { await dashboardStorage.write(LOCAL_WALLPAPER_KEY, dataUrl); } catch { /* Status is shown by the helper. */ }
}

function getTextByteLength(value: unknown) {
  try {
    return new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value ?? "")).length;
  } catch {
    return String(value ?? "").length;
  }
}

function getChromeStorageBytes(area: "sync" | "local", key: string): Promise<number | null> {
  return new Promise((resolve) => {
    const storageArea = chromeApi?.storage?.[area];
    if (!storageArea?.getBytesInUse) {
      resolve(null);
      return;
    }

    storageArea.getBytesInUse(key, (bytes: number) => {
      if (chromeApi.runtime?.lastError) {
        resolve(null);
        return;
      }
      resolve(Number.isFinite(bytes) ? bytes : null);
    });
  });
}

async function getStorageStatus(data: StoredData, customWallpaperDataUrl: string): Promise<StorageStatus> {
  const bookmarkBytes = getTextByteLength({ favorites: data.favorites, favoriteGroups: data.favoriteGroups });
  const settingsBytes = getTextByteLength({ settings: data.settings, weatherLocation: data.weatherLocation });
  const localBytesEstimate = getTextByteLength(customWallpaperDataUrl);
  const syncBytes = await getChromeStorageBytes("sync", SYNC_KEY);
  const localBytes = await getChromeStorageBytes("local", LOCAL_WALLPAPER_KEY);
  const usedBytes = (syncBytes ?? bookmarkBytes + settingsBytes) + (localBytes ?? localBytesEstimate);
  const syncQuota = Number(chromeApi?.storage?.sync?.QUOTA_BYTES) || 102400;
  const localQuota = Number(chromeApi?.storage?.local?.QUOTA_BYTES) || 10485760;

  return {
    usedBytes,
    quotaBytes: syncQuota + localQuota,
    categories: [
      { label: "Bookmarks", bytes: bookmarkBytes, color: "var(--violet)" },
      { label: "Settings", bytes: settingsBytes, color: "var(--amber)" },
      { label: "Local media", bytes: localBytes ?? localBytesEstimate, color: "var(--cyan)" },
    ],
  };
}

function clearStoredData(): Promise<void> {
  return new Promise((resolve) => {
    if (chromeApi?.storage) {
      chromeApi.storage.sync.remove(SYNC_KEY, () => { void chromeApi.runtime?.lastError; chromeApi.storage.local.remove([SYNC_KEY, LOCAL_WALLPAPER_KEY], () => { void chromeApi.runtime?.lastError; try { browserStorage?.removeItem(SYNC_KEY); browserStorage?.removeItem(LOCAL_WALLPAPER_KEY); } catch {} resolve(); }); });
      return;
    }

    localStorage.removeItem(SYNC_KEY);
    localStorage.removeItem(LOCAL_WALLPAPER_KEY);
    resolve();
  });
}

function useStoredDashboardData() {
  const [settings, setSettingsState] = useState(defaultSettings);
  const [favorites, setFavoritesState] = useState(defaultFavorites);
  const [favoriteGroups, setFavoriteGroupsState] = useState(defaultFavoriteGroups);
  const [weatherLocation, setWeatherLocationState] = useState<WeatherLocation | null>(null);
  const [customWallpaperDataUrl, setCustomWallpaperState] = useState("");
  const [loaded, setLoaded] = useState(false);
  const lastSyncedDataRef = useRef("");
  const latestSavedAt = useRef(0);

  useEffect(() => {
    let mounted = true;
    Promise.all([getSyncData(), getLocalWallpaper()]).then(([data, wallpaper]) => {
      if (!mounted) return;
      const groups = normalizeFavoriteGroups(data.favoriteGroups);
      latestSavedAt.current = Number((data as any)._pikanavSavedAt || 0);
      const nextSettings = mergeSettings(data.settings);
      const nextFavorites = normalizeFavorites(data.favorites, groups);
      const nextLocation = normalizeWeatherLocation(data.weatherLocation);
      lastSyncedDataRef.current = JSON.stringify({ settings: nextSettings, favorites: nextFavorites, favoriteGroups: groups, weatherLocation: nextLocation });
      setSettingsState(nextSettings);
      setFavoriteGroupsState(groups);
      setFavoritesState(nextFavorites);
      setWeatherLocationState(nextLocation);
      setCustomWallpaperState(wallpaper);
      setLoaded(true);
    }).catch((error) => reportStorageStatus(error.message || "Saved settings could not be read."));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const nextData = { settings, favorites, favoriteGroups, weatherLocation };
    const serialized = JSON.stringify(nextData);
    if (serialized === lastSyncedDataRef.current) return;

    lastSyncedDataRef.current = serialized;
    const snapshot = { ...nextData, _pikanavSavedAt: Math.max(Date.now(), latestSavedAt.current + 1) };
    latestSavedAt.current = snapshot._pikanavSavedAt;
    void dashboardStorage.write(SYNC_KEY, snapshot).catch(() => undefined);
    const sync = () => { void dashboardStorage.syncDashboard(snapshot); };
    const id = window.setTimeout(sync, SYNC_WRITE_DEBOUNCE_MS);
    const flush = () => { window.clearTimeout(id); sync(); };
    window.addEventListener("pagehide", flush, { once: true });
    return () => { window.clearTimeout(id); window.removeEventListener("pagehide", flush); };
  }, [favoriteGroups, favorites, loaded, settings, weatherLocation]);

  useEffect(() => {
    if (!loaded) return;
    const update = (changes: Record<string, any>) => {
      const incoming = changes[SYNC_KEY]?.newValue;
      if (!incoming || Number(incoming._pikanavSavedAt || 0) <= latestSavedAt.current) return;
      latestSavedAt.current = Number(incoming._pikanavSavedAt);
      const groups = normalizeFavoriteGroups(incoming.favoriteGroups);
      const next = { settings: mergeSettings(incoming.settings), favorites: normalizeFavorites(incoming.favorites, groups), favoriteGroups: groups, weatherLocation: normalizeWeatherLocation(incoming.weatherLocation) };
      lastSyncedDataRef.current = JSON.stringify(next);
      setSettingsState(next.settings);
      setFavoritesState(next.favorites);
      setFavoriteGroupsState(groups);
      setWeatherLocationState(next.weatherLocation);
    };
    chromeApi?.storage?.onChanged?.addListener(update);
    return () => chromeApi?.storage?.onChanged?.removeListener(update);
  }, [loaded]);

  function setSettings(next: PikaSettings) {
    setSettingsState(mergeSettings(next));
  }

  function setFavorites(next: Favorite[]) {
    setFavoritesState(normalizeFavorites(next, favoriteGroups));
  }

  function setFavoriteGroups(next: FavoriteGroup[]) {
    const groups = normalizeFavoriteGroups(next);
    const fallbackGroupId = groups[0]?.id || "pinned";
    const knownGroups = new Set(groups.map((group) => group.id));
    setFavoriteGroupsState(groups);
    setFavoritesState((items) => items.map((item) => (knownGroups.has(item.groupId || "") ? item : { ...item, groupId: fallbackGroupId })));
  }

  function setCustomWallpaper(dataUrl: string) {
    setCustomWallpaperState(dataUrl);
    void setLocalWallpaper(dataUrl);
  }

  const setWeatherLocation = useCallback((nextLocation: WeatherLocation | null) => {
    setWeatherLocationState(nextLocation ? normalizeWeatherLocation(nextLocation) : null);
  }, []);

  function importData(data: Partial<StoredData> & { customWallpaperDataUrl?: string }) {
    if (data.settings) setSettingsState(mergeSettings(data.settings));
    const groups = normalizeFavoriteGroups(data.favoriteGroups || favoriteGroups);
    if (data.favoriteGroups) setFavoriteGroupsState(groups);
    if (Array.isArray(data.favorites)) setFavoritesState(normalizeFavorites(data.favorites, groups));
    if ("weatherLocation" in data) setWeatherLocationState(normalizeWeatherLocation(data.weatherLocation));
    if (typeof data.customWallpaperDataUrl === "string") setCustomWallpaper(safeImageData(data.customWallpaperDataUrl));
  }

  async function resetAll() {
    await clearStoredData();
    setSettingsState(defaultSettings);
    setFavoritesState(defaultFavorites);
    setFavoriteGroupsState(defaultFavoriteGroups);
    setWeatherLocationState(null);
    setCustomWallpaperState("");
  }

  return { loaded, settings, setSettings, favorites, setFavorites, favoriteGroups, setFavoriteGroups, weatherLocation, setWeatherLocation, customWallpaperDataUrl, setCustomWallpaper, importData, resetAll };
}

function loadLocalProfile(): LocalProfile {
  try {
    const locale = localStorage.getItem(PROFILE_LOCALE_KEY);
    return {
      displayName: localStorage.getItem(PROFILE_DISPLAY_NAME_KEY) || DEFAULT_PROFILE.displayName,
      avatarDataUrl: localStorage.getItem(PROFILE_AVATAR_KEY) || "",
      locale: normalizeInterfaceLocale((locale as InterfaceLocale | "en" | null) || DEFAULT_PROFILE.locale),
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

function saveLocalProfile(profile: LocalProfile): LocalProfile {
  const next = {
    displayName: updateGreetingName(profile.displayName),
    avatarDataUrl: profile.avatarDataUrl || "",
    locale: normalizeInterfaceLocale(profile.locale),
  } satisfies LocalProfile;

  try {
    localStorage.setItem(PROFILE_DISPLAY_NAME_KEY, next.displayName);
    localStorage.setItem(PROFILE_LOCALE_KEY, next.locale);
    if (next.avatarDataUrl) {
      localStorage.setItem(PROFILE_AVATAR_KEY, next.avatarDataUrl);
    } else {
      localStorage.removeItem(PROFILE_AVATAR_KEY);
    }
  } catch (error) {
    reportStorageStatus("Profile changes could not be saved. Try a smaller avatar or export a backup.");
  }

  applyTranslations();
  return next;
}

function renderLocalProfile(profile: LocalProfile, setProfile: (profile: LocalProfile) => void) {
  setProfile(profile);
}

function openProfileSettings(setOpen: (open: boolean) => void) {
  setOpen(true);
}

function updateGreetingName(displayName: string) {
  return displayName.trim() || DEFAULT_PROFILE.displayName;
}

function updateAvatarIcon(profile: LocalProfile) {
  return profile.avatarDataUrl || getProfileInitials(profile);
}

function applyTranslations() {
  document.documentElement.lang = loadLocalProfile().locale;
}

function getProfileInitials(profile: LocalProfile) {
  const name = updateGreetingName(profile.displayName);
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "A";
}

function getLocalizedGreeting(date: Date, profile: LocalProfile) {
  const hour = date.getHours();
  if (profile.locale === "zh-CN") {
    if (hour < 12) return "早上好";
    if (hour < 17) return "下午好";
    return "晚上好";
  }
  return getGreeting(date);
}

function getDashboardGreeting(date: Date, locale: InterfaceLocale) {
  const hour = date.getHours();
  const greetings: Record<InterfaceLocale, [string, string, string]> = {
    "en-US": ["Good morning", "Good afternoon", "Good evening"],
    "en-GB": ["Good morning", "Good afternoon", "Good evening"],
    "fr-FR": ["Bonjour", "Bon apres-midi", "Bonsoir"],
    "de-DE": ["Guten Morgen", "Guten Tag", "Guten Abend"],
    "ja-JP": ["おはよう", "こんにちは", "こんばんは"],
    "zh-CN": ["早上好", "下午好", "晚上好"],
  };
  return greetings[locale][hour < 12 ? 0 : hour < 17 ? 1 : 2];
}

function useLocalProfile() {
  const [profile, setProfile] = useState<LocalProfile>(() => loadLocalProfile());

  useEffect(() => {
    applyTranslations();
  }, []);

  function saveProfile(nextProfile: LocalProfile) {
    renderLocalProfile(saveLocalProfile(nextProfile), setProfile);
  }

  return { profile, saveProfile };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function getGreeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function isProbablyUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return true;
  if (/\s/.test(value)) return false;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/.*)?$/i.test(value);
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:\/\//i.test(trimmed))) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return /^https?:$/.test(url.protocol) && url.hostname && !url.username && !url.password ? url.href : "";
  } catch { return ""; }
}

function getFavoriteFaviconUrl(url: string) {
  try {
    const parsed = new URL(normalizeUrl(url));
    if (!/^https?:$/.test(parsed.protocol)) return "";
    return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(parsed.origin)}&sz=64`;
  } catch {
    return "";
  }
}

function openUrl(url: string, currentTab = false) {
  if (chromeApi?.tabs?.create && !currentTab) {
    chromeApi.tabs.create({ url });
    return;
  }
  window.location.href = url;
}

function getFallbackWeatherLocation(locale: InterfaceLocale): WeatherLocation {
  const region = locale.split("-")[1];
  if (region === "GB") return { latitude: 51.5072, longitude: -0.1276, name: "London", country: "United Kingdom", source: "fallback", accuracyMeters: null, timezone: "Europe/London" };
  if (region === "DE") return { latitude: 52.52, longitude: 13.405, name: "Berlin", country: "Germany", source: "fallback", accuracyMeters: null, timezone: "Europe/Berlin" };
  if (region === "FR") return { latitude: 48.8566, longitude: 2.3522, name: "Paris", country: "France", source: "fallback", accuracyMeters: null, timezone: "Europe/Paris" };
  if (region === "JP") return { latitude: 35.6762, longitude: 139.6503, name: "Tokyo", country: "Japan", source: "fallback", accuracyMeters: null, timezone: "Asia/Tokyo" };
  if (region === "CN") return { latitude: 39.9042, longitude: 116.4074, name: "Beijing", country: "China", source: "fallback", accuracyMeters: null, timezone: "Asia/Shanghai" };
  if (region === "US") return { latitude: 40.7128, longitude: -74.006, name: "New York", country: "United States", source: "fallback", accuracyMeters: null, timezone: "America/New_York" };
  return { latitude: 1.3521, longitude: 103.8198, name: "Singapore", country: "Singapore", source: "fallback", accuracyMeters: null, timezone: "Asia/Singapore" };
}

function getWeatherDescription(code: number | null) {
  if (code === null) return "Forecast";
  if (code === 0) return "Clear";
  if ([1, 2, 3].includes(code)) return "Partly cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Forecast";
}

function formatTemperature(value: number | null, unit: "°C") {
  return value === null || Number.isNaN(value) ? "--" : `${Math.round(value)}${unit}`;
}

function getWeatherIcon(code: number | null, isDay = true) {
  if (code !== null && [61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) return <CloudRain size={24} />;
  return isDay ? <Sun size={24} /> : <Moon size={24} />;
}

function getBrowserWeatherLocation(locale: InterfaceLocale): Promise<WeatherLocation> {
  const fallback = getFallbackWeatherLocation(locale);
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(fallback);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        name: "Current location",
        country: "Device",
        source: "browser",
        accuracyMeters: Math.round(position.coords.accuracy),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "auto",
      }),
      () => resolve(fallback),
      { enableHighAccuracy: false, maximumAge: 30 * 60 * 1000, timeout: 5000 },
    );
  });
}

async function fetchWeatherSnapshot(locale: InterfaceLocale, preferredLocation: WeatherLocation | null): Promise<WeatherSnapshot> {
  const location = preferredLocation || await getBrowserWeatherLocation(locale);
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    forecast_days: "5",
    timezone: location.timezone || "auto",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Weather service unavailable");
  const data = await response.json();
  const current = data.current || {};
  const daily = data.daily || {};

  return {
    status: "ready",
    location: location.name,
    verifiedLocation: location,
    temperature: readNullableNumber(current.temperature_2m),
    apparentTemperature: readNullableNumber(current.apparent_temperature),
    humidity: readNullableNumber(current.relative_humidity_2m),
    precipitation: readNullableNumber(current.precipitation),
    windSpeed: readNullableNumber(current.wind_speed_10m),
    code: readNullableNumber(current.weather_code),
    isDay: current.is_day !== 0,
    unit: "°C",
    windUnit: "km/h",
    updatedAt: current.time || new Date().toISOString(),
    forecast: Array.isArray(daily.time) ? daily.time.slice(0, 5).map((date: string, index: number) => ({
      date,
      code: Number(daily.weather_code?.[index] ?? 0),
      high: readNullableNumber(daily.temperature_2m_max?.[index]),
      low: readNullableNumber(daily.temperature_2m_min?.[index]),
      precipitationChance: readNullableNumber(daily.precipitation_probability_max?.[index]),
    })) : [],
  };
}

async function searchWeatherLocations(query: string, locale: InterfaceLocale): Promise<WeatherLocation[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const language = locale.slice(0, 2).toLowerCase();
  const params = new URLSearchParams({
    name: trimmed,
    count: "6",
    language,
    format: "json",
  });
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Location search unavailable");
  const data = await response.json();
  return Array.isArray(data.results) ? data.results.map((item: any) => ({
    name: String(item.name || "Unknown"),
    country: String(item.country || item.country_code || ""),
    source: "manual" as const,
    accuracyMeters: null,
    timezone: String(item.timezone || "auto"),
    latitude: Number(item.latitude),
    longitude: Number(item.longitude),
  })).filter((item: WeatherLocation) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)) : [];
}

function getSearchDetail(provider: (typeof searchProviders)[SearchProviderId], mode: SearchMode) {
  return `Search ${provider.label}${mode === "web" ? "" : ` ${searchModeLabels[mode]}`}`;
}

function createSearchSuggestions(values: unknown[], provider: (typeof searchProviders)[SearchProviderId], mode: SearchMode, query: string): SearchSuggestion[] {
  const seen = new Set<string>();
  const lowerQuery = query.toLowerCase();
  const detail = getSearchDetail(provider, mode);
  return values
    .map((value) => String(value || "").replace(/\s+/g, " ").trim())
    .filter((text) => {
      const key = text.toLowerCase();
      if (!text || key === lowerQuery || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10)
    .map((text) => ({ kind: mode === "ai" ? "ai" : "search", text, detail }));
}

async function requestSearchSuggestions(query: string, provider: SearchProviderId, mode: SearchMode, signal: AbortSignal) {
  const canUseExtensionProxy = Boolean(chromeApi?.runtime?.sendMessage);
  if (canUseExtensionProxy) {
    return requestExtensionSearchSuggestions(query, provider, mode);
  }

  const params = new URLSearchParams({ q: query, engine: provider, mode });
  try {
    const response = await fetch(`/api/suggest?${params.toString()}`, { signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Suggestion service unavailable");
    return Array.isArray(data?.suggestions) ? data.suggestions : [];
  } catch (error) {
    if (signal.aborted) throw error;
    if (!chromeApi?.runtime?.sendMessage) throw error;

    return requestExtensionSearchSuggestions(query, provider, mode);
  }
}

function requestExtensionSearchSuggestions(query: string, provider: SearchProviderId, mode: SearchMode) {
  return new Promise<unknown[]>((resolve, reject) => {
    chromeApi.runtime.sendMessage({ type: "GET_SEARCH_SUGGESTIONS", query, engine: provider, mode }, (response: any) => {
      const runtimeError = chromeApi.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message || "Suggestion service unavailable"));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "Suggestion service unavailable"));
        return;
      }
      resolve(Array.isArray(response.suggestions) ? response.suggestions : []);
    });
  });
}

function getImageSearchTerm(file: File, fallbackQuery: string) {
  const query = fallbackQuery.trim();
  if (query) return query;
  return file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "uploaded image";
}

function usePageVisible() {
  const [visible, setVisible] = useState(() => typeof document === "undefined" || document.visibilityState === "visible");
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return undefined;
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  return reducedMotion;
}

function useDialogFocus(selector: string, onClose: () => void, enabled = true) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!enabled) return;
    const dialog = document.querySelector<HTMLElement>(selector);
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not([type="hidden"]):not(:disabled), textarea, select, a[href], [tabindex="0"]')).filter((element) => element.getClientRects().length > 0);
    controls()[0]?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const items = controls();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first) return;
      if (!dialog.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handle);
    return () => { document.removeEventListener("keydown", handle); if (previous?.isConnected) previous.focus(); };
  }, [selector, enabled]);
}

function useClock(pageVisible: boolean) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!pageVisible) return undefined;
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => window.clearInterval(id);
  }, [pageVisible]);
  return now;
}

function sendRuntimeCommand<T = any>(type: "PIKANAV_COMPANION_COMMAND" | "mediaCommand", command: "ping" | "getSystemStats" | "getCurrentMedia" | "playPause" | "next" | "previous", mediaTarget?: Pick<MediaSession, "backend" | "target">): Promise<T & { ok?: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (!chromeApi?.runtime?.sendMessage) {
      resolve({ ok: false, error: "Extension runtime unavailable" } as T & { ok: boolean; error: string });
      return;
    }

    chromeApi.runtime.sendMessage({ type, command, ...mediaTarget }, (response: T & { ok?: boolean; error?: string }) => {
      if (chromeApi.runtime.lastError) {
        resolve({ ok: false, error: chromeApi.runtime.lastError.message } as T & { ok: boolean; error: string });
        return;
      }
      resolve(response || ({ ok: false, error: "Extension returned an empty response" } as T & { ok: boolean; error: string }));
    });
  });
}

async function sendCompanionCommand<T = any>(command: "ping" | "getSystemStats" | "getCurrentMedia" | "playPause" | "next" | "previous"): Promise<T & { ok?: boolean; error?: string }> {
  const response = await sendRuntimeCommand<T>("PIKANAV_COMPANION_COMMAND", command);
  const error = String(response?.error || "");
  if (response?.ok || !/(unsupported|empty response|receiving end)/i.test(error)) return response;
  return sendRuntimeCommand<T>("mediaCommand", command);
}

function useSystemStats(pageVisible: boolean) {
  const [stats, setStats] = useState<SystemStats>({ cpu: null, ram: null, disk: null, gpu: null, status: "loading" });
  useEffect(() => {
    if (!pageVisible) return undefined;
    let mounted = true;
    let timerId: number | undefined;
    async function requestStats() {
      const response = await sendCompanionCommand<{ stats?: Partial<SystemStats> }>("getSystemStats");
      if (!mounted) return;
      if (!response?.ok || !response.stats) {
        setStats({
          cpu: null,
          ram: null,
          disk: null,
          gpu: null,
          status: "unavailable",
          error: response?.error || "System stats unavailable",
        });
        return;
      }
      setStats({
        cpu: clampNullablePercent(response.stats.cpu),
        ram: clampNullablePercent(response.stats.ram),
        disk: clampNullablePercent(response.stats.disk),
        gpu: clampNullablePercent(response.stats.gpu),
        memoryUsedMb: readNullableNumber(response.stats.memoryUsedMb),
        memoryTotalMb: readNullableNumber(response.stats.memoryTotalMb),
        diskName: response.stats.diskName || "Disk",
        diskUsedGb: readNullableNumber(response.stats.diskUsedGb),
        diskTotalGb: readNullableNumber(response.stats.diskTotalGb),
        gpuNote: response.stats.gpuNote,
        status: "ready",
      });
    }
    const schedule = () => {
      timerId = window.setTimeout(async () => {
        await requestStats();
        if (mounted && pageVisible) schedule();
      }, SYSTEM_STATS_POLL_MS);
    };
    void requestStats().then(() => {
      if (mounted && pageVisible) schedule();
    });
    return () => {
      mounted = false;
      if (timerId !== undefined) window.clearTimeout(timerId);
    };
  }, [pageVisible]);
  return stats;
}

function useMediaSession(pageVisible: boolean) {
  const [media, setMedia] = useState<MediaSession>({
    status: "loading",
    hasSession: false,
    title: "",
    artist: "",
    album: "",
    sourceAppUserModelId: "",
    playbackStatus: "",
    artworkUrl: "",
  });
  const mediaRef = useRef(media);
  useEffect(() => {
    mediaRef.current = media;
  }, [media]);

  function applyMediaResponse(response: Partial<MediaSession> & { ok?: boolean; error?: string }) {
    if (!response?.ok) {
      const error = String(response?.error || "");
      const noSession = /no active media session/i.test(error);
      setMedia((current) => ({
        ...current,
        status: noSession ? "empty" : "unavailable",
        hasSession: false,
        title: noSession ? "" : current.title,
        artist: noSession ? "" : current.artist,
        album: noSession ? "" : current.album,
        sourceAppUserModelId: noSession ? "" : current.sourceAppUserModelId,
        playbackStatus: noSession ? "" : current.playbackStatus,
        artworkUrl: noSession ? "" : current.artworkUrl,
        error: noSession ? undefined : response?.error || "Media companion unavailable",
        commandPending: undefined,
      }));
      return;
    }

    const hasSession = Boolean(response.hasSession);
    setMedia({
      status: hasSession ? "ready" : "empty",
      hasSession,
      title: String(response.title || ""),
      artist: String(response.artist || ""),
      album: String(response.album || ""),
      sourceAppUserModelId: String(response.sourceAppUserModelId || ""),
      playbackStatus: String(response.playbackStatus || ""),
      artworkUrl: String(response.artworkUrl || ""),
      backend: response.backend,
      target: response.target,
      capabilities: response.capabilities,
      requiresBrowserAccess: response.requiresBrowserAccess,
      commandPending: undefined,
    });
  }

  async function refresh() {
    const response = await sendRuntimeCommand<Partial<MediaSession>>("mediaCommand", "getCurrentMedia");
    applyMediaResponse(response);
  }

  async function runControl(command: "previous" | "playPause" | "next") {
    const current = mediaRef.current;
    if (current.commandPending || !current.hasSession) return;
    setMedia((current) => ({ ...current, commandPending: command }));
    const response = await sendRuntimeCommand("mediaCommand", command, { backend: current.backend, target: current.target });
    if (!response?.ok) {
      setMedia((current) => ({
        ...current,
        status: "unavailable",
        error: response?.error || "Media control failed",
        commandPending: undefined,
      }));
      return;
    }
    window.setTimeout(refresh, 250);
  }

  useEffect(() => {
    if (!pageVisible) return undefined;
    let mounted = true;
    let timerId: number | undefined;
    const safeRefresh = async () => {
      if (document.visibilityState !== "visible") return;
      if (mediaRef.current.commandPending) return;
      const response = await sendRuntimeCommand<Partial<MediaSession>>("mediaCommand", "getCurrentMedia");
      if (!mounted) return;
      applyMediaResponse(response);
    };

    const schedule = () => {
      const current = mediaRef.current;
      const active = current.status === "ready" && /playing/i.test(current.playbackStatus);
      timerId = window.setTimeout(async () => {
        await safeRefresh();
        if (mounted && pageVisible) schedule();
      }, active ? MEDIA_POLL_ACTIVE_MS : MEDIA_POLL_IDLE_MS);
    };

    void safeRefresh().then(() => {
      if (mounted && pageVisible) schedule();
    });
    const onPermissionChange = () => { void safeRefresh(); };
    chromeApi?.permissions?.onAdded?.addListener(onPermissionChange);
    chromeApi?.permissions?.onRemoved?.addListener(onPermissionChange);
    return () => {
      mounted = false;
      chromeApi?.permissions?.onAdded?.removeListener(onPermissionChange);
      chromeApi?.permissions?.onRemoved?.removeListener(onPermissionChange);
      if (timerId !== undefined) window.clearTimeout(timerId);
    };
  }, [pageVisible]);

  return { media, refresh, runControl };
}

function useWeather(locale: InterfaceLocale, weatherLocation: WeatherLocation | null, onLocationResolved: (location: WeatherLocation) => void, enabled: boolean) {
  const [weather, setWeather] = useState<WeatherSnapshot>({
    status: "loading",
    location: weatherLocation?.name || "",
    verifiedLocation: weatherLocation,
    temperature: null,
    apparentTemperature: null,
    humidity: null,
    precipitation: null,
    windSpeed: null,
    code: null,
    isDay: true,
    unit: "°C",
    windUnit: "km/h",
    updatedAt: "",
    forecast: [],
  });

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    async function refreshWeather() {
      if (document.visibilityState !== "visible") return;
      try {
        const snapshot = await fetchWeatherSnapshot(locale, weatherLocation);
        if (!mounted) return;
        setWeather(snapshot);
        if (!weatherLocation && snapshot.verifiedLocation) onLocationResolved(snapshot.verifiedLocation);
      } catch (error) {
        if (!mounted) return;
        setWeather((current) => ({
          ...current,
          status: "unavailable",
          error: error instanceof Error ? error.message : "Weather unavailable",
        }));
      }
    }

    setWeather((current) => ({ ...current, status: current.status === "ready" ? "ready" : "loading" }));
    void refreshWeather();
    const id = window.setInterval(refreshWeather, 30 * 60 * 1000);
    document.addEventListener("visibilitychange", refreshWeather);
    window.addEventListener("pikanav:refresh-weather", refreshWeather);
    return () => {
      mounted = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", refreshWeather);
      window.removeEventListener("pikanav:refresh-weather", refreshWeather);
    };
  }, [locale, onLocationResolved, weatherLocation, enabled]);

  return weather;
}

function clampNullablePercent(value: unknown) {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function readNullableNumber(value: unknown) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatStorage(value: number | null | undefined, unit: "MB" | "GB") {
  if (!Number.isFinite(Number(value))) return "--";
  const number = Number(value);
  return `${number >= 100 ? Math.round(number) : number.toFixed(1)} ${unit}`;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb >= 100 ? Math.round(kb) : kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb >= 100 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

function formatTime(date: Date, settings: PikaSettings, withSeconds = false) {
  return date.toLocaleTimeString(settings.language.locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
    hour12: settings.language.timeFormat === "12-hour",
  });
}

function formatDate(date: Date, settings: PikaSettings, long = false) {
  if (long) {
    return date.toLocaleDateString(settings.language.locale, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  }
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  if (settings.language.dateFormat === "DD/MM/YYYY") return `${d}/${m}/${y}`;
  if (settings.language.dateFormat === "YYYY-MM-DD") return `${y}-${m}-${d}`;
  return `${m}/${d}/${y}`;
}

function AppTopBar({
  now,
  stats,
  settings,
  profile,
  focusMode,
  overview,
  onToggleFocus,
  onOpenSettings,
  onOpenProfile,
}: {
  now: Date;
  stats: SystemStats;
  settings: PikaSettings;
  profile: LocalProfile;
  focusMode: boolean;
  overview: DashboardOverview;
  onToggleFocus: () => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
}) {
  const day = now.toLocaleDateString(settings.language.locale, { weekday: "short" });
  const avatarIcon = updateAvatarIcon(profile);
  const locale = settings.language.locale;
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("pikanav.readNotifications") || "[]");
      return Array.isArray(stored) ? stored.filter((id) => typeof id === "string") : [];
    } catch {
      return [];
    }
  });
  const notificationRef = useRef<HTMLDivElement>(null);
  const unreadCount = overview.notifications.filter((item) => !readNotificationIds.includes(item.id)).length;

  useEffect(() => {
    if (!notificationOpen) return;
    const close = (event: MouseEvent) => {
      if (!notificationRef.current?.contains(event.target as Node)) setNotificationOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotificationOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", escape);
    };
  }, [notificationOpen]);

  function toggleNotifications() {
    setNotificationOpen((open) => {
      const next = !open;
      if (next) {
        const ids = Array.from(new Set([...readNotificationIds, ...overview.notifications.map((item) => item.id)])).slice(-100);
        setReadNotificationIds(ids);
        try { localStorage.setItem("pikanav.readNotifications", JSON.stringify(ids)); } catch { /* Read state still works for this session. */ }
      }
      return next;
    });
  }

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <div className="time-block" aria-label="Current time and date">
          <span className="top-time">{formatTime(now, settings)}</span>
          <span className="top-date">
            {day}, {formatDate(now, settings)}
          </span>
        </div>
        {settings.visibility.topBarStats && <StatsPill stats={stats} locale={locale} />}
      </div>
      <div className="topbar-actions">
        <button className={`shortcut-pill ${focusMode ? "active" : ""}`} type="button" onClick={onToggleFocus}>
          <Moon size={14} />
          <span>{focusMode ? t(locale, "focusOn") : t(locale, "focus")}</span>
        </button>
        <div className="notification-shell" ref={notificationRef}>
          <IconButton label={t(locale, "notifications")} onClick={toggleNotifications}>
            <Bell size={16} />
            {unreadCount > 0 && <span className="notice-count">{unreadCount > 9 ? "9+" : unreadCount}</span>}
          </IconButton>
          {notificationOpen && (
            <section className="notification-panel" role="dialog" aria-label={t(locale, "notifications")}>
              <div className="notification-panel-head">
                <div><strong>{t(locale, "notifications")}</strong><span>{overview.notifications.length} updates</span></div>
                <button type="button" onClick={() => setNotificationOpen(false)} aria-label="Close notifications"><X size={14} /></button>
              </div>
              <div className="notification-list">
                {overview.notifications.length === 0 && <div className="notification-empty"><Bell size={20} /><span>You're all caught up</span></div>}
                {overview.notifications.map((item) => {
                  const Icon = item.tone === "task" ? ListTodo : AlertCircle;
                  const content = <><i className={`notification-icon ${item.tone}`}><Icon size={14} /></i><span><strong>{item.title}</strong><small>{item.detail}</small></span></>;
                  return item.href
                    ? <a href={item.href} target="_blank" rel="noreferrer" key={item.id}>{content}</a>
                    : <div className="notification-item" key={item.id}>{content}</div>;
                })}
              </div>
              <div className="notification-panel-foot">Tasks and system status update automatically</div>
            </section>
          )}
        </div>
        <IconButton label={t(locale, "settings")} onClick={onOpenSettings}>
          <Settings size={16} />
        </IconButton>
        <button className="profile-button" type="button" aria-label={t(locale, "profileSettings")} title={t(locale, "profileSettings")} onClick={onOpenProfile}>
          {profile.avatarDataUrl ? <img src={profile.avatarDataUrl} alt="" /> : <span>{avatarIcon}</span>}
        </button>
      </div>
    </header>
  );
}

function IconButton({ label, children, onClick }: { label: string; children: ReactNode; onClick?: () => void }) {
  return (
    <button className="icon-button" type="button" aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}

function SearchProviderIcon({ provider }: { provider: (typeof searchProviders)[SearchProviderId] }) {
  return (
    <span className="provider-icon" aria-hidden="true">
      <img
        src={provider.iconUrl}
        alt=""
        loading="lazy"
        onError={(event) => {
          event.currentTarget.style.display = "none";
          const fallback = event.currentTarget.nextElementSibling;
          if (fallback instanceof HTMLElement) fallback.style.display = "inline";
        }}
      />
      <b>{provider.short}</b>
    </span>
  );
}

function StatsPill({ stats, locale = "en-US" }: { stats: SystemStats; locale?: InterfaceLocale | LocalProfile["locale"] }) {
  if (stats.status !== "ready") {
    return (
      <div className="stats-pill stats-pill-muted" title={stats.error || "System stats loading"}>
        <span className="stat-chip">{stats.status === "loading" ? t(locale, "systemStatsLoading") : t(locale, "systemStatsOffline")}</span>
      </div>
    );
  }
  return (
    <div className="stats-pill" title={t(locale, "systemStatsTitle")}>
      <StatChip label="CPU" value={stats.cpu} color="violet" />
      <StatChip label="RAM" value={stats.ram} color="cyan" />
      <StatChip label="DSK" value={stats.disk} color="green" />
    </div>
  );
}

function StatChip({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <span className={`stat-chip stat-${color}`}>
      <span className="stat-dot" />
      <span>{label}</span>
      <strong>{value ?? "--"}%</strong>
    </span>
  );
}

function SearchHero({ settings, locale }: { settings: PikaSettings; locale: InterfaceLocale }) {
  const [mode, setMode] = useState<SearchMode>("web");
  const [provider, setProvider] = useState<SearchProviderId>("google");
  const [query, setQuery] = useState("");
  const [providerOpen, setProviderOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [suggestionStatus, setSuggestionStatus] = useState<SuggestionStatus>("idle");
  const [suggestionError, setSuggestionError] = useState("");
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [voiceListening, setVoiceListening] = useState(false);
  const [imageUploadOpen, setImageUploadOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ url: string; name: string } | null>(null);
  const [imageUploadError, setImageUploadError] = useState("");
  const heroRef = useRef<HTMLElement>(null);
  const recognitionRef = useRef<any>(null);
  const suggestionCacheRef = useRef<Map<string, SuggestionCacheEntry>>(new Map());
  const selectedProvider = searchProviders[provider];
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!providerOpen && !suggestionsOpen) return;
    const handler = (event: MouseEvent) => {
      if (!heroRef.current?.contains(event.target as Node)) setProviderOpen(false);
      if (!heroRef.current?.contains(event.target as Node)) setSuggestionsOpen(false);
    };
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProviderOpen(false);
        setSuggestionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    window.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      window.removeEventListener("keydown", keyHandler);
    };
  }, [providerOpen, suggestionsOpen]);

  useEffect(() => {
    setActiveSuggestion(0);
    setSuggestionError("");

    if (trimmedQuery.length < MIN_SUGGESTION_QUERY_LENGTH || isProbablyUrl(trimmedQuery)) {
      setSuggestions([]);
      setSuggestionStatus(trimmedQuery ? "ready" : "idle");
      return;
    }

    const cacheKey = `${provider}:${mode}:${trimmedQuery.toLowerCase()}`;
    const cached = suggestionCacheRef.current.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      setSuggestions(cached.suggestions);
      setSuggestionStatus("ready");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSuggestionStatus("loading");
      try {
        const values = await requestSearchSuggestions(trimmedQuery, provider, mode, controller.signal);
        if (controller.signal.aborted) return;
        if (suggestionCacheRef.current.size >= 100) suggestionCacheRef.current.delete(suggestionCacheRef.current.keys().next().value!);
        const nextSuggestions = createSearchSuggestions(values, selectedProvider, mode, trimmedQuery);
        suggestionCacheRef.current.set(cacheKey, {
          suggestions: nextSuggestions,
          expiresAt: Date.now() + SUGGESTION_CACHE_MS,
        });
        setSuggestions(nextSuggestions);
        setSuggestionStatus("ready");
      } catch (error) {
        if (controller.signal.aborted) return;
        setSuggestions([]);
        setSuggestionStatus("error");
        setSuggestionError(error instanceof Error ? error.message : "Suggestion service unavailable");
      }
    }, SUGGESTION_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [mode, provider, selectedProvider, trimmedQuery]);

  useEffect(() => {
    return () => recognitionRef.current?.abort?.();
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreview?.url) URL.revokeObjectURL(imagePreview.url);
    };
  }, [imagePreview]);

  useEffect(() => {
    if (!imageUploadOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setImageUploadOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [imageUploadOpen]);

  function runSearch(value = query, searchMode = mode) {
    const trimmed = value.trim();
    if (!trimmed) return;
    const destination = isProbablyUrl(trimmed) && searchMode !== "ai" ? normalizeUrl(trimmed) : selectedProvider.buildUrl(trimmed, searchMode);
    openUrl(destination, true);
  }

  function startVoiceSearch() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      openUrl(searchProviders.google.buildUrl(query || "voice search", "web"), true);
      return;
    }

    recognitionRef.current?.abort?.();
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = locale;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setVoiceListening(true);
    recognition.onerror = () => setVoiceListening(false);
    recognition.onend = () => setVoiceListening(false);
    recognition.onresult = (event: any) => {
      const transcript = String(event.results?.[0]?.[0]?.transcript || "").trim();
      if (!transcript) return;
      setQuery(transcript);
      setSuggestionsOpen(false);
      runSearch(transcript);
    };
    try { recognition.start(); } catch { setVoiceListening(false); setSuggestionError("Voice search is unavailable. Type your search instead."); setSuggestionStatus("error"); setSuggestionsOpen(true); }
  }

  function openImageUpload() {
    setImageUploadError("");
    setProviderOpen(false);
    setSuggestionsOpen(false);
    setImageUploadOpen(true);
  }

  function handleImageFile(file?: File) {
    setImageUploadError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageUploadError("Please choose an image file.");
      return;
    }

    const searchTerm = getImageSearchTerm(file, query);
    setImagePreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return { url: URL.createObjectURL(file), name: file.name };
    });
    setMode("images");
    setQuery(searchTerm);
    setSuggestionsOpen(false);
    setImageUploadOpen(false);
    openUrl(selectedProvider.buildUrl(searchTerm, "images"), true);
  }

  function handleImageDrop(event: ReactDragEvent<HTMLLabelElement>) {
    event.preventDefault();
    handleImageFile(event.dataTransfer.files?.[0]);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    runSearch(query);
  }

  function chooseSuggestion(text: string) {
    setQuery(text);
    setSuggestionsOpen(false);
    runSearch(text);
  }

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setSuggestionsOpen(false);
      setProviderOpen(false);
      return;
    }
    if (!suggestionsOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) setSuggestionsOpen(true);
    if (!suggestions.length) return;
    if (event.key === "Enter" && showSuggestionPanel) { event.preventDefault(); chooseSuggestion(suggestions[activeSuggestion]?.text || query); return; }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion((current) => (current + 1) % suggestions.length);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion((current) => (current - 1 + suggestions.length) % suggestions.length);
    }
  }

  const showSuggestionPanel = suggestionsOpen && Boolean(trimmedQuery) && (suggestions.length > 0 || suggestionStatus === "loading" || suggestionStatus === "error");

  return (
    <section ref={heroRef} className={`search-hero ${providerOpen || suggestionsOpen ? "provider-open" : ""}`} aria-label={t(locale, "shortcutSearch")}>
      <nav className="search-tabs" aria-label={t(locale, "searchMode")}>
        {searchModes.map((item) => (
          <button key={item.id} className={mode === item.id ? "active" : ""} type="button" onClick={() => setMode(item.id)}>
            {t(locale, item.labelKey)}
          </button>
        ))}
      </nav>
      <form className="search-bar" onSubmit={submit}>
        <div className="provider-wrap">
          <button className="provider-button" type="button" onClick={() => setProviderOpen((open) => !open)} aria-expanded={providerOpen}>
            <SearchProviderIcon provider={selectedProvider} />
            {selectedProvider.label}
            <ChevronDown size={14} />
          </button>
          {providerOpen && (
            <div className="provider-menu">
              {(Object.keys(searchProviders) as SearchProviderId[]).map((id) => (
                <button key={id} type="button" className={provider === id ? "active" : ""} onClick={() => { setProvider(id); setProviderOpen(false); }}>
                  <SearchProviderIcon provider={searchProviders[id]} />
                  {searchProviders[id].label}
                  {provider === id && <Check size={14} />}
                </button>
              ))}
            </div>
          )}
        </div>
        <Search className="search-leading-icon" size={20} />
        <input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveSuggestion(0);
            setSuggestionsOpen(true);
          }}
          onFocus={() => setSuggestionsOpen(true)}
          onKeyDown={handleSearchKeyDown}
          placeholder={mode === "ai" ? `Ask ${selectedProvider.label} or enter a prompt` : t(locale, "searchPlaceholder")(selectedProvider.label)}
          spellCheck={false}
          role="combobox"
          aria-label={t(locale, "searchPlaceholder")(selectedProvider.label)}
          aria-activedescendant={showSuggestionPanel && suggestions.length ? `search-suggestion-${activeSuggestion}` : undefined}
          aria-expanded={showSuggestionPanel}
          aria-controls="search-suggestions"
          aria-autocomplete="list"
        />
        <button className={`tool-button ${voiceListening ? "active" : ""}`} type="button" aria-label={t(locale, "voiceSearch")} title={t(locale, "voiceSearch")} onClick={startVoiceSearch}><Mic size={18} /></button>
        <button className="tool-button" type="button" aria-label={t(locale, "imageSearch")} title={t(locale, "imageSearch")} onClick={openImageUpload}><ImageIcon size={18} /></button>
        <button className="submit-button" type="submit" aria-label={t(locale, "submitSearch")}><ArrowRight size={21} /></button>
      </form>
      {imageUploadOpen && (
        <div className="image-upload-popover" role="dialog" aria-modal="true" aria-label={t(locale, "imageSearch")}>
          <div className="image-upload-head">
            <div>
              <strong>{t(locale, "imageSearch")}</strong>
              <span>{selectedProvider.label} Images</span>
            </div>
            <button type="button" className="icon-button" onClick={() => setImageUploadOpen(false)} aria-label="Close image upload"><X size={15} /></button>
          </div>
          <label
            className="image-upload-dropzone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleImageDrop}
          >
            {imagePreview ? <img src={imagePreview.url} alt="" /> : <ImageIcon size={28} />}
            <span>Choose an image to search by filename</span>
            <small>{imagePreview?.name || "The filename becomes your image search. The image itself is not uploaded."}</small>
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                handleImageFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
          {imageUploadError && <p className="image-upload-error">{imageUploadError}</p>}
        </div>
      )}
      {showSuggestionPanel && (
        <div className="suggestions-menu" id="search-suggestions" role="listbox">
          {suggestionStatus === "loading" && (
            <div className="suggestion-status" role="status">
              <span className="suggestion-spinner" />
              <span>Fetching suggestions from {selectedProvider.label}</span>
            </div>
          )}
          {suggestionStatus === "error" && (
            <div className="suggestion-status suggestion-error" role="status">
              <AlertCircle size={15} />
              <span>{suggestionError || "Suggestion service unavailable"}</span>
            </div>
          )}
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.kind}-${suggestion.text}-${index}`}
              type="button"
              role="option"
              id={`search-suggestion-${index}`}
              aria-selected={activeSuggestion === index}
              className={activeSuggestion === index ? "active" : ""}
              onMouseEnter={() => setActiveSuggestion(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseSuggestion(suggestion.text)}
            >
              <span className={`suggestion-icon suggestion-${suggestion.kind}`}>
                {suggestion.kind === "ai" ? <Sparkles size={15} /> : suggestion.kind === "history" ? <History size={15} /> : <Search size={15} />}
              </span>
              <span>
                <strong>{suggestion.text}</strong>
                <small>{suggestion.detail}</small>
              </span>
              <ArrowRight size={14} />
            </button>
          ))}
        </div>
      )}
      {settings.visibility.keyboardShortcuts && (
        <div className="shortcut-hints">
          <span><kbd>Enter</kbd> {t(locale, "shortcutSearch")}</span>
          <span><kbd>Tab</kbd> {t(locale, "shortcutNavigate")}</span>
          <span><kbd>Esc</kbd> {t(locale, "shortcutCloseMenus")}</span>
        </div>
      )}
    </section>
  );
}

function QuickActions({ focusMode, locale, onToggleFocus }: { focusMode: boolean; locale: InterfaceLocale; onToggleFocus: () => void }) {
  const actionLabels: Record<InterfaceLocale, Record<string, string>> = {
    "en-US": { newtab: "New Tab", downloads: "Downloads", translate: "Translate", history: "History" },
    "en-GB": { newtab: "New Tab", downloads: "Downloads", translate: "Translate", history: "History" },
    "fr-FR": { newtab: "Nouvel onglet", downloads: "Telechargements", translate: "Traduire", history: "Historique" },
    "de-DE": { newtab: "Neuer Tab", downloads: "Downloads", translate: "Ubersetzen", history: "Verlauf" },
    "ja-JP": { newtab: "新しいタブ", downloads: "ダウンロード", translate: "翻訳", history: "履歴" },
    "zh-CN": { newtab: "新标签页", downloads: "下载", translate: "翻译", history: "历史" },
  };
  const cleanActionLabels: Partial<Record<InterfaceLocale, Record<string, string>>> = {
    "ja-JP": { newtab: "新しいタブ", downloads: "ダウンロード", translate: "翻訳", history: "履歴" },
    "zh-CN": { newtab: "新标签页", downloads: "下载", translate: "翻译", history: "历史" },
  };
  function runAction(action: (typeof quickActions)[number]["action"]) {
    if (action === "newtab") openUrl("chrome://newtab");
    if (action === "downloads") openUrl("chrome://downloads");
    if (action === "history") openUrl("chrome://history");
    if (action === "translate") openUrl("https://translate.google.com/");
    if (action === "focus") onToggleFocus();
  }
  return (
    <div className="quick-actions" aria-label={t(locale, "quickActions")}>
      {quickActions.map(({ label, icon: Icon, action }) => (
        <button key={label} className={action === "focus" && focusMode ? "active" : ""} type="button" onClick={() => runAction(action)}>
          <Icon size={16} />
          <span>{action === "focus" && focusMode ? t(locale, "focusOn") : action === "focus" ? t(locale, "focus") : cleanActionLabels[locale]?.[action] || actionLabels[locale][action] || label}</span>
        </button>
      ))}
    </div>
  );
}

function FavoritesGrid({ favorites, favoriteGroups, locale, onFavoritesChange }: { favorites: Favorite[]; favoriteGroups: FavoriteGroup[]; locale: InterfaceLocale; onFavoritesChange: (items: Favorite[]) => void }) {
  const fallbackGroupId = favoriteGroups[0]?.id || "pinned";
  const [activeGroup, setActiveGroup] = useState(fallbackGroupId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFavorite, setEditingFavorite] = useState<Favorite | null>(null);
  const [menuFavoriteId, setMenuFavoriteId] = useState<string | null>(null);
  const visibleGroups = favoriteGroups.length ? favoriteGroups : defaultFavoriteGroups;
  const selectedGroup = visibleGroups.some((group) => group.id === activeGroup) ? activeGroup : visibleGroups[0].id;
  const groupFavorites = favorites.filter((favorite) => (favorite.groupId || fallbackGroupId) === selectedGroup);

  useEffect(() => {
    if (!visibleGroups.some((group) => group.id === activeGroup)) setActiveGroup(visibleGroups[0].id);
  }, [activeGroup, visibleGroups]);

  function addFavorite(favorite: Favorite) {
    onFavoritesChange([...favorites, normalizeFavorite(favorite, favorites.length, selectedGroup)]);
    setModalOpen(false);
  }
  function updateFavorite(nextFavorite: Favorite) {
    onFavoritesChange(favorites.map((favorite) => favorite.id === nextFavorite.id ? normalizeFavorite(nextFavorite, 0, selectedGroup) : favorite));
    setEditingFavorite(null);
    setMenuFavoriteId(null);
  }
  function deleteFavorite(favoriteId: string) {
    onFavoritesChange(favorites.filter((favorite) => favorite.id !== favoriteId));
    setMenuFavoriteId(null);
  }

  return (
    <section className="favorites-section" aria-labelledby="favorites-title">
      <div className="section-head">
        <div>
          <span className="section-eyebrow">{t(locale, "launcher")}</span>
          <h2 id="favorites-title">{t(locale, "favorites")}</h2>
        </div>
        <div className="favorite-tabs" role="tablist" aria-label={t(locale, "favoriteGroups")}>
          {visibleGroups.map((group) => (
            <button key={group.id} className={selectedGroup === group.id ? "active" : ""} type="button" onClick={() => setActiveGroup(group.id)}>
              {group.label} <span>{favorites.filter((favorite) => (favorite.groupId || fallbackGroupId) === group.id).length}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="favorite-grid">
        {groupFavorites.map((favorite) => (
          <div key={favorite.id || `${favorite.label}-${favorite.url}`} className="favorite-item">
            <button
              className="favorite-tile"
              type="button"
              style={{ "--tile-accent": favorite.accent } as CSSProperties}
              onClick={() => openUrl(favorite.url)}
              onContextMenu={(event) => {
                event.preventDefault();
                setMenuFavoriteId(menuFavoriteId === favorite.id ? null : favorite.id || null);
              }}
            >
              <FavoriteIcon favorite={favorite} />
              <span>{favorite.label}</span>
            </button>
            {menuFavoriteId === favorite.id && (
              <div className="favorite-context-menu" role="menu">
                <button type="button" onClick={() => setEditingFavorite(favorite)}>Edit shortcut</button>
                <button type="button" onClick={() => deleteFavorite(favorite.id || "")}>Delete shortcut</button>
              </div>
            )}
          </div>
        ))}
        <button className="favorite-tile add-tile" type="button" onClick={() => setModalOpen(true)}>
          <span className="favorite-icon"><Plus size={22} /></span>
          <span>{t(locale, "add")}</span>
        </button>
      </div>
      {modalOpen && <FavoriteModal favoriteGroups={visibleGroups} initialGroupId={selectedGroup} onClose={() => setModalOpen(false)} onSave={addFavorite} />}
      {editingFavorite && <FavoriteModal favorite={editingFavorite} favoriteGroups={visibleGroups} initialGroupId={selectedGroup} onClose={() => { setEditingFavorite(null); setMenuFavoriteId(null); }} onSave={updateFavorite} />}
    </section>
  );
}

function FavoriteIcon({ favorite }: { favorite: Favorite }) {
  const [failed, setFailed] = useState(false);
  const showFavicon = Boolean(favorite.faviconUrl && !failed);

  return (
    <span className="favorite-icon">
      {showFavicon ? (
        <img src={favorite.faviconUrl} alt="" onError={() => setFailed(true)} />
      ) : (
        <span>{favorite.monogram}</span>
      )}
    </span>
  );
}

function FavoriteModal({ favorite, favoriteGroups, initialGroupId, onClose, onSave }: { favorite?: Favorite; favoriteGroups: FavoriteGroup[]; initialGroupId: string; onClose: () => void; onSave: (favorite: Favorite) => void }) {
  useDialogFocus(".add-modal", onClose);
  const [label, setLabel] = useState(favorite?.label || "");
  const [url, setUrl] = useState(favorite?.url || "");
  const [groupId, setGroupId] = useState(favorite?.groupId || initialGroupId);
  const isEditing = Boolean(favorite);
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmedLabel = label.trim();
    const trimmedUrl = url.trim();
    if (!trimmedLabel || !trimmedUrl) return;
    if (!normalizeUrl(trimmedUrl)) { setError("Enter a valid HTTP or HTTPS website address."); return; }
    onSave({
      ...favorite,
      id: favorite?.id || createId("favorite"),
      groupId,
      label: trimmedLabel,
      url: normalizeUrl(trimmedUrl),
      faviconUrl: getFavoriteFaviconUrl(trimmedUrl),
      monogram: trimmedLabel.slice(0, 2).toUpperCase(),
      accent: favorite?.accent || "#a78bfa",
    });
  }
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="add-modal glass-card" role="dialog" aria-modal="true" onSubmit={submit} aria-label={isEditing ? "Edit favorite" : "Add favorite"}>
        <div className="modal-title-row">
          <div><span className="section-eyebrow">{isEditing ? "Edit favorite" : "New favorite"}</span><h3>{isEditing ? "Edit shortcut" : "Add launcher item"}</h3></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close add favorite"><X size={16} /></button>
        </div>
        <label>Name<input required maxLength={160} autoFocus value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Name" /></label>
        <label>URL<input required value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" /></label>
        <label>
          Group
          <select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
            {favoriteGroups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
          </select>
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="modal-submit" type="submit">{isEditing ? "Save changes" : "Add favorite"}</button>
      </form>
    </div>
  );
}

function ProfileSettingsModal({ profile, onClose, onSave }: { profile: LocalProfile; onClose: () => void; onSave: (profile: LocalProfile) => void }) {
  useDialogFocus(".profile-modal", onClose);
  const [draft, setDraft] = useState<LocalProfile>(profile);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewProfile = { ...draft, displayName: updateGreetingName(draft.displayName) };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(t(draft.locale, "avatarImageError"));
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError(t(draft.locale, "avatarSizeError"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setDraft((current) => ({ ...current, avatarDataUrl: String(reader.result || "") }));
    };
    reader.onerror = () => setError(t(draft.locale, "avatarReadError"));
    reader.readAsDataURL(file);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({
      displayName: updateGreetingName(draft.displayName),
      avatarDataUrl: draft.avatarDataUrl || "",
      locale: draft.locale,
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="profile-modal glass-card" role="dialog" aria-modal="true" onSubmit={submit} aria-label={t(draft.locale, "profileSettings")}>
        <div className="modal-title-row">
          <div>
            <span className="section-eyebrow">{t(draft.locale, "localProfile")}</span>
            <h3>{t(draft.locale, "profileSettings")}</h3>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t(draft.locale, "closeProfileSettings")}><X size={16} /></button>
        </div>

        <div className="profile-avatar-editor">
          <div className="profile-avatar-preview" aria-hidden="true">
            {draft.avatarDataUrl ? <img src={draft.avatarDataUrl} alt="" /> : <span>{getProfileInitials(previewProfile)}</span>}
          </div>
          <div className="profile-avatar-actions">
            <input ref={fileInputRef} hidden type="file" accept="image/*" onChange={handleAvatarUpload} />
            <button type="button" onClick={() => fileInputRef.current?.click()}><Upload size={16} />{t(draft.locale, "uploadAvatar")}</button>
            <button type="button" onClick={() => setDraft((current) => ({ ...current, avatarDataUrl: "" }))}>{t(draft.locale, "removeAvatar")}</button>
          </div>
        </div>

        <label>
          {t(draft.locale, "displayName")}
          <input value={draft.displayName} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} placeholder="Alex" />
        </label>

        <label>
          {t(draft.locale, "language")}
          <select value={draft.locale} onChange={(event) => setDraft((current) => ({ ...current, locale: normalizeInterfaceLocale(event.target.value as InterfaceLocale) }))}>
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
            <option value="fr-FR">French</option>
            <option value="de-DE">German</option>
            <option value="ja-JP">Japanese</option>
            <option value="zh-CN">Chinese (Simplified)</option>
          </select>
        </label>

        {error && <p className="profile-error" role="alert">{error}</p>}

        <div className="profile-modal-actions">
          <button type="button" onClick={onClose}>{t(draft.locale, "cancel")}</button>
          <button className="modal-submit" type="submit">{t(draft.locale, "save")}</button>
        </div>
      </form>
    </div>
  );
}

function TodayCard({ now, settings, locale }: { now: Date; settings: PikaSettings; locale: InterfaceLocale }) {
  const time = now.toLocaleTimeString(settings.language.locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: settings.language.timeFormat === "12-hour",
  }).replace(/\s?(AM|PM)$/i, "");
  const seconds = pad(now.getSeconds());
  const ampm = settings.language.timeFormat === "12-hour" ? (now.getHours() >= 12 ? "PM" : "AM") : "";
  const worldTimes = [
    { city: "NY", zone: "America/New_York" },
    { city: "LON", zone: "Europe/London" },
    { city: "TK", zone: "Asia/Tokyo" },
  ].map((item) => ({ city: item.city, time: now.toLocaleTimeString(settings.language.locale, { timeZone: item.zone, hour: "2-digit", minute: "2-digit", hour12: settings.language.timeFormat === "12-hour" }) }));
  return (
    <aside className="glass-card today-card" aria-label={t(locale, "today")}>
      <div className="card-kicker">{t(locale, "today")}</div>
      <div className="clock-row">
        <span className="clock-large">{time}</span>
        <span className="clock-meta">{ampm}<small>:{seconds}</small></span>
      </div>
      <p>{formatDate(now, settings, true)}</p>
      <div className="world-row">{worldTimes.map((item) => <span key={item.city}>{item.city} {item.time}</span>)}</div>
    </aside>
  );
}

function MusicCard({ media, locale, onControl }: { media: MediaSession; locale: InterfaceLocale; onControl: (command: "previous" | "playPause" | "next") => void }) {
  const [permissionError, setPermissionError] = useState("");
  const isPlaying = /playing/i.test(media.playbackStatus);
  const disabled = media.status !== "ready" || !media.hasSession || Boolean(media.commandPending);
  function enableBrowserMedia() {
    setPermissionError("");
    chromeApi?.permissions?.request({ origins: ["http://*/*", "https://*/*"] }, (granted: boolean) => {
      const error = chromeApi.runtime.lastError;
      if (!granted || error) setPermissionError(error?.message || t(locale, "browserMediaDeclined"));
    });
  }

  return (
    <aside className="glass-card music-card" aria-label={t(locale, "music")}>
      <div className="card-title-row">
        <div className="card-kicker">{t(locale, "music")}</div>
        <span className={`live-badge ${media.status === "ready" ? "native" : ""}`}>{media.status === "ready" ? media.playbackStatus || t(locale, "live") : media.status === "loading" ? t(locale, "loading") : t(locale, "offline")}</span>
      </div>
      <div className="music-body">
        <div className="album-art">
          {media.artworkUrl ? <img src={media.artworkUrl} alt="" /> : <Music2 size={24} />}
        </div>
        <div>
          <strong>{media.status === "ready" ? media.title || t(locale, "untitledTrack") : media.status === "empty" ? t(locale, "noActiveMedia") : t(locale, "mediaUnavailable")}</strong>
          <span>{media.status === "ready" ? media.artist || media.album || media.sourceAppUserModelId || t(locale, "unknownSource") : media.error || t(locale, "startPlayback")}</span>
        </div>
      </div>
      <div className="media-controls" aria-label="Media controls">
        <button type="button" disabled={disabled || media.capabilities?.previous === false} onClick={() => onControl("previous")} aria-label={t(locale, "previousTrack")}>
          <SkipBack size={16} />
        </button>
        <button className="play-control" type="button" disabled={disabled || media.capabilities?.playPause === false} onClick={() => onControl("playPause")} aria-label={isPlaying ? t(locale, "pause") : t(locale, "play")}>
          {isPlaying ? <Pause size={17} /> : <Play size={17} />}
        </button>
        <button type="button" disabled={disabled || media.capabilities?.next === false} onClick={() => onControl("next")} aria-label={t(locale, "nextTrack")}>
          <SkipForward size={16} />
        </button>
      </div>
      <p className="widget-note">{media.status === "ready" ? `${media.backend === "browser" ? t(locale, "chromeTab") : "Windows"} · ${media.sourceAppUserModelId || media.album || t(locale, "windowsMediaSession")}` : media.error || t(locale, "waitingMedia")}</p>
      {media.requiresBrowserAccess && <div className="browser-media-access">
        <p className="widget-note">{t(locale, "browserMediaAccess")}</p>
        <button type="button" onClick={enableBrowserMedia}>{t(locale, "enableBrowserMedia")}</button>
      </div>}
      {permissionError && <p className="widget-note" role="status">{permissionError}</p>}
    </aside>
  );
}

function SystemStatsWidget({ stats, locale }: { stats: SystemStats; locale: InterfaceLocale }) {
  return (
    <aside className="glass-card system-card" aria-label={t(locale, "system")}>
      <div className="card-title-row">
        <div className="card-kicker">{t(locale, "system")}</div>
        <span className={`live-badge ${stats.status === "ready" ? "native" : ""}`}>{stats.status === "ready" ? t(locale, "live") : t(locale, "offline")}</span>
      </div>
      {stats.status === "ready" ? (
        <>
          <Meter label="CPU" value={stats.cpu} color="#a78bfa" />
          <Meter label="RAM" value={stats.ram} color="#22d3ee" />
          <Meter label="DSK" value={stats.disk} color="#34d399" />
          {stats.gpu !== null && <Meter label="GPU" value={stats.gpu} color="#f472b6" />}
          <p className="widget-note">
            {stats.memoryUsedMb && stats.memoryTotalMb ? `Memory ${formatStorage(stats.memoryUsedMb, "MB")} / ${formatStorage(stats.memoryTotalMb, "MB")}` : t(locale, "memoryUnavailable")}
            {stats.diskTotalGb ? ` · ${stats.diskName || "Disk"} ${formatStorage(stats.diskUsedGb, "GB")} / ${formatStorage(stats.diskTotalGb, "GB")}` : ""}
          </p>
        </>
      ) : (
        <div className="stats-fallback"><Sparkles size={18} /><p>{stats.status === "loading" ? t(locale, "connectingCompanion") : t(locale, "nativeStatsUnavailable")}</p></div>
      )}
    </aside>
  );
}

function WeatherWidget({ locale, weather, onLocationChange }: { locale: InterfaceLocale; weather: WeatherSnapshot; onLocationChange: (location: WeatherLocation | null) => void }) {
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<WeatherLocation[]>([]);
  const [locationSearchStatus, setLocationSearchStatus] = useState<"idle" | "loading" | "error">("idle");
  const description = getWeatherDescription(weather.code);
  const updated = weather.updatedAt ? new Date(weather.updatedAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "";
  const location = weather.verifiedLocation;
  const locationName = location ? `${location.name}${location.country ? `, ${location.country}` : ""}` : "your location";
  const isApproximate = Boolean(location && (location.source === "fallback" || (location.source === "browser" && (location.accuracyMeters ?? 0) > 5000)));

  useEffect(() => {
    if (!locationPickerOpen) return;
    const trimmed = locationQuery.trim();
    if (trimmed.length < 2) {
      setLocationResults([]);
      setLocationSearchStatus("idle");
      return;
    }

    let cancelled = false;
    setLocationSearchStatus("loading");
    const id = window.setTimeout(() => {
      void searchWeatherLocations(trimmed, locale)
        .then((results) => {
          if (!cancelled) {
            setLocationResults(results);
            setLocationSearchStatus("idle");
          }
        })
        .catch(() => {
          if (!cancelled) setLocationSearchStatus("error");
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [locale, locationPickerOpen, locationQuery]);

  function chooseLocation(nextLocation: WeatherLocation) {
    onLocationChange(nextLocation);
    setLocationPickerOpen(false);
    setLocationQuery("");
    setLocationResults([]);
  }

  function useBrowserLocation() {
    onLocationChange(null);
    setLocationPickerOpen(false);
    setLocationQuery("");
    setLocationResults([]);
  }

  return (
    <aside className="glass-card weather-card" aria-label={widgetLabel({ id: "weather", label: "Weather" }, locale)}>
      <div className="card-title-row">
        <div className="card-kicker">{widgetLabel({ id: "weather", label: "Weather" }, locale)}</div>
        <span className={`live-badge ${weather.status === "ready" ? "native" : ""}`}>{weather.status === "ready" ? t(locale, "live") : weather.status === "loading" ? t(locale, "loading") : t(locale, "offline")}</span>
      </div>
      {weather.status === "ready" ? (
        <>
          <div className="weather-body">
            <div className="weather-mark">{getWeatherIcon(weather.code, weather.isDay)}</div>
            <div>
              <strong>{formatTemperature(weather.temperature, weather.unit)}</strong>
              <span>{description} · {weather.location}</span>
            </div>
          </div>
          <div className="weather-metrics">
            <span><Thermometer size={13} />Feels {formatTemperature(weather.apparentTemperature, weather.unit)}</span>
            <span><Droplets size={13} />{weather.humidity ?? "--"}%</span>
            <span><Wind size={13} />{weather.windSpeed === null ? "--" : Math.round(weather.windSpeed)} {weather.windUnit}</span>
          </div>
          <div className="weather-forecast" aria-label="5 day forecast">
            {weather.forecast.map((day) => (
              <div key={day.date}>
                <span>{new Date(`${day.date}T12:00:00`).toLocaleDateString(locale, { weekday: "short" })}</span>
                <strong>{formatTemperature(day.high, weather.unit)}</strong>
                <small>{formatTemperature(day.low, weather.unit)}</small>
              </div>
            ))}
          </div>
          <p className="widget-note">Updated {updated}. Inline data by Open-Meteo.</p>
        </>
      ) : (
        <div className="stats-fallback">
          <Sparkles size={18} />
          <p>{weather.status === "loading" ? "Loading local weather..." : weather.error || "Weather is unavailable."}</p>
          {weather.status === "unavailable" && <button type="button" onClick={() => window.dispatchEvent(new Event("pikanav:refresh-weather"))}>Retry weather</button>}
        </div>
      )}
      <div className="weather-location-footer">
        <span>Weather for {locationName}</span>
        {isApproximate && <small>Approximate location{location?.accuracyMeters ? ` · +/-${Math.round(location.accuracyMeters / 1000)} km` : ""}</small>}
        <button type="button" onClick={() => setLocationPickerOpen((open) => !open)}>Change location</button>
      </div>
      {locationPickerOpen && (
        <div className="weather-location-picker" role="dialog" aria-label="Change weather location">
          <input autoFocus value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} placeholder="Search city" />
          <div className="weather-location-results">
            {locationSearchStatus === "loading" && <span>Searching...</span>}
            {locationSearchStatus === "error" && <span>Location search unavailable.</span>}
            {locationSearchStatus === "idle" && locationQuery.trim().length >= 2 && locationResults.length === 0 && <span>No matching cities.</span>}
            {locationResults.map((result) => (
              <button key={`${result.name}-${result.country}-${result.latitude}-${result.longitude}`} type="button" onClick={() => chooseLocation(result)}>
                <strong>{result.name}</strong>
                <small>{result.country} · {result.timezone}</small>
              </button>
            ))}
            <button type="button" className="weather-location-current" onClick={useBrowserLocation}>Use browser location</button>
          </div>
        </div>
      )}
    </aside>
  );
}

function QuickNotesWidget({ data, onChange, locale }: { data: WidgetData; onChange: (next: WidgetData) => void; locale: InterfaceLocale }) {
  const label = widgetLabel(widgetConfig.find((item) => item.id === "notes")!, locale);
  return (
    <aside className="glass-card utility-widget notes-widget" aria-label={label}>
      <div className="card-title-row">
        <div className="card-kicker">{label}</div>
        <span className="widget-count">{data.notes.length}/4000</span>
      </div>
      <textarea
        value={data.notes}
        maxLength={4000}
        onChange={(event) => onChange({ ...data, notes: event.target.value })}
        placeholder="Capture a thought, link, or reminder..."
        aria-label="Quick note"
      />
      <div className="utility-footer">
        <span>Saved automatically</span>
        {data.notes && <button type="button" onClick={() => onChange({ ...data, notes: "" })}>Clear</button>}
      </div>
    </aside>
  );
}

function TaskListWidget({ data, onChange, locale }: { data: WidgetData; onChange: (next: WidgetData) => void; locale: InterfaceLocale }) {
  const [title, setTitle] = useState("");
  const label = widgetLabel(widgetConfig.find((item) => item.id === "tasks")!, locale);
  const openCount = data.tasks.filter((task) => !task.completed).length;

  function addTask(event: FormEvent) {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle || data.tasks.length >= 100) return;
    onChange({ ...data, tasks: [{ id: createId("task"), title: nextTitle, completed: false, createdAt: new Date().toISOString() }, ...data.tasks] });
    setTitle("");
  }

  return (
    <aside className="glass-card utility-widget tasks-widget" aria-label={label}>
      <div className="card-title-row">
        <div className="card-kicker">{label}</div>
        <span className="widget-count">{openCount} open</span>
      </div>
      <form className="widget-add-form" onSubmit={addTask}>
        <input value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} placeholder="Add a task" aria-label="Task title" />
        <button type="submit" disabled={data.tasks.length >= 100} aria-label="Add task"><Plus size={15} /></button>
      </form>
      {data.tasks.length >= 100 && <p className="widget-note">Task limit reached. Delete a task before adding another.</p>}
      <div className="task-list">
        {data.tasks.length === 0 && <div className="widget-empty"><ListTodo size={18} /><span>No tasks yet</span></div>}
        {data.tasks.map((task) => (
          <div className={`task-item ${task.completed ? "completed" : ""}`} key={task.id}>
            <button className="task-check" type="button" onClick={() => onChange({ ...data, tasks: data.tasks.map((item) => item.id === task.id ? { ...item, completed: !item.completed } : item) })} aria-label={task.completed ? "Mark incomplete" : "Mark complete"}>
              {task.completed && <Check size={12} />}
            </button>
            <span>{task.title}</span>
            <button className="widget-delete" type="button" onClick={() => onChange({ ...data, tasks: data.tasks.filter((item) => item.id !== task.id) })} aria-label={`Delete ${task.title}`}><X size={13} /></button>
          </div>
        ))}
      </div>
    </aside>
  );
}

function useDashboardOverview(widgetData: WidgetData, stats: SystemStats, systemEnabled: boolean): DashboardOverview {
  return useMemo(() => {
    const openTasks = widgetData.tasks.filter((task) => !task.completed);
    const notifications: DashboardNotification[] = openTasks.slice(0, 4).map((task) => ({
      id: `task:${task.id}`, title: task.title, detail: "Open task", tone: "task",
    }));
    if (systemEnabled && stats.status === "ready") {
      if ((stats.cpu || 0) >= 90) notifications.unshift({ id: "system:cpu", title: "High CPU usage", detail: `CPU is at ${stats.cpu}%`, tone: "system" });
      if ((stats.ram || 0) >= 90) notifications.unshift({ id: "system:ram", title: "High memory usage", detail: `Memory is at ${stats.ram}%`, tone: "system" });
    }
    if (systemEnabled && stats.status === "unavailable") {
      notifications.unshift({ id: "system:offline", title: "System monitor is offline", detail: stats.error || "Windows companion is unavailable.", tone: "system" });
    }
    return { openTaskCount: openTasks.length, notifications };
  }, [widgetData.tasks, stats.cpu, stats.ram, stats.status, stats.error, systemEnabled]);
}

type NewsItem = { title: string; link: string; source: string; publishedAt: string };

function parseNewsFeed(xml: string): NewsItem[] {
  const document = new DOMParser().parseFromString(xml, "text/xml");
  return Array.from(document.querySelectorAll("item")).slice(0, 5).flatMap((item) => {
    const rawTitle = item.querySelector("title")?.textContent?.trim() || "";
    const source = item.querySelector("source")?.textContent?.trim() || "";
    const link = item.querySelector("link")?.textContent?.trim() || "";
    const title = source && rawTitle.endsWith(` - ${source}`) ? rawTitle.slice(0, -source.length - 3) : rawTitle;
    return title && /^https?:\/\//.test(link) ? [{ title, link, source, publishedAt: item.querySelector("pubDate")?.textContent || "" }] : [];
  });
}

function getNewsFeed(topic: string): Promise<NewsItem[]> {
  return new Promise((resolve, reject) => {
    if (!chromeApi?.runtime?.sendMessage) {
      fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=en-US&gl=US&ceid=US:en`)
        .then((response) => response.ok ? response.text() : Promise.reject(new Error("News feed unavailable")))
        .then((xml) => resolve(parseNewsFeed(xml)))
        .catch(reject);
      return;
    }
    chromeApi.runtime.sendMessage({ type: "GET_NEWS_FEED", topic }, (response: { ok?: boolean; xml?: string; error?: string }) => {
      if (chromeApi.runtime?.lastError || !response?.ok || !response.xml) {
        reject(new Error(response?.error || chromeApi.runtime?.lastError?.message || "News feed unavailable"));
        return;
      }
      resolve(parseNewsFeed(response.xml));
    });
  });
}

function NewsWidget({ data, onChange, locale }: { data: WidgetData; onChange: (next: WidgetData) => void; locale: InterfaceLocale }) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const label = widgetLabel(widgetConfig.find((item) => item.id === "news")!, locale);
  const topics = ["technology", "world", "business", "science"];

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    void getNewsFeed(data.newsTopic).then((nextItems) => {
      if (!cancelled) {
        setItems(nextItems);
        setStatus("ready");
      }
    }).catch(() => {
      if (!cancelled) setStatus("error");
    });
    return () => { cancelled = true; };
  }, [data.newsTopic, retry]);

  return (
    <aside className="glass-card utility-widget news-widget" aria-label={label}>
      <div className="card-title-row">
        <div className="card-kicker">{label}</div>
        <span className={`live-badge ${status === "ready" ? "native" : ""}`}>{status === "loading" ? "Loading" : status === "ready" ? "Live" : "Offline"}</span>
      </div>
      <div className="news-topics">
        {topics.map((topic) => <button type="button" className={data.newsTopic === topic ? "active" : ""} key={topic} onClick={() => onChange({ ...data, newsTopic: topic })}>{topic}</button>)}
      </div>
      <div className="news-list">
        {status === "loading" && <div className="widget-empty"><Sparkles size={18} /><span>Loading headlines...</span></div>}
        {status === "error" && <div className="widget-empty"><Newspaper size={18} /><span>Headlines are unavailable right now.</span><button type="button" onClick={() => setRetry((value) => value + 1)}>Retry headlines</button></div>}
        {status === "ready" && items.length === 0 && <div className="widget-empty"><Newspaper size={18} /><span>No headlines for this topic.</span></div>}
        {items.map((item) => (
          <a href={item.link} target="_blank" rel="noreferrer" key={item.link}>
            <span>{item.title}</span>
            <small>{item.source || (item.publishedAt ? new Date(item.publishedAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "Google News")}</small>
          </a>
        ))}
      </div>
    </aside>
  );
}
function Meter({ label, value, color }: { label: string; value: number | null; color: string }) {
  const percent = value ?? 0;
  return (
    <div className="meter">
      <span>{label}</span>
      <div className="meter-track"><i style={{ width: `${percent}%`, background: `linear-gradient(90deg, ${color}, ${color}66)` }} /></div>
      <strong style={{ color }}>{value ?? "--"}%</strong>
    </div>
  );
}

function ComingSoonWidget({ label, description, locale }: { label: string; description: string; locale: InterfaceLocale }) {
  return (
    <aside className="glass-card placeholder-card" aria-label={label}>
      <div className="card-title-row"><div className="card-kicker">{label}</div><span className="mock-badge">{t(locale, "soon")}</span></div>
      <p>{description}</p>
    </aside>
  );
}

function RightWidgets({ now, stats, media, weather, settings, widgetData, locale, onMediaControl, onWeatherLocationChange, onWidgetDataChange }: { now: Date; stats: SystemStats; media: MediaSession; weather: WeatherSnapshot; settings: PikaSettings; widgetData: WidgetData; locale: InterfaceLocale; onMediaControl: (command: "previous" | "playPause" | "next") => void; onWeatherLocationChange: (location: WeatherLocation | null) => void; onWidgetDataChange: (data: WidgetData) => void }) {
  const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>(() => loadWidgetOrder());
  const [draggingWidget, setDraggingWidget] = useState<WidgetId | null>(null);
  useEffect(() => {
    const reload = () => setWidgetOrder(loadWidgetOrder());
    window.addEventListener("pikanav:widget-order", reload);
    return () => window.removeEventListener("pikanav:widget-order", reload);
  }, []);
  const orderedWidgets = widgetOrder
    .map((id) => widgetConfig.find((widget) => widget.id === id))
    .filter((widget): widget is (typeof widgetConfig)[number] => Boolean(widget))
    .filter((widget) => settings.widgets[widget.id]);

  function reorder(sourceId: WidgetId, targetId: WidgetId) {
    const next = moveWidget(widgetOrder, sourceId, targetId);
    setWidgetOrder(next);
    saveWidgetOrder(next);
  }

  function renderWidget(widget: (typeof widgetConfig)[number]) {
    if (widget.id === "clock") return <TodayCard now={now} settings={settings} locale={locale} />;
    if (widget.id === "music") return <MusicCard media={media} locale={locale} onControl={onMediaControl} />;
    if (widget.id === "system") return <SystemStatsWidget stats={stats} locale={locale} />;
    if (widget.id === "weather") return <WeatherWidget locale={locale} weather={weather} onLocationChange={onWeatherLocationChange} />;
    if (widget.id === "notes") return <QuickNotesWidget data={widgetData} onChange={onWidgetDataChange} locale={locale} />;
    if (widget.id === "tasks") return <TaskListWidget data={widgetData} onChange={onWidgetDataChange} locale={locale} />;
    if (widget.id === "news") return <NewsWidget data={widgetData} onChange={onWidgetDataChange} locale={locale} />;
    return null;
  }

  return (
    <section className={`widget-column ${settings.visibility.snapWidgets ? "widget-grid-mode" : ""}`} aria-label={t(locale, "dashboardWidgets")}>
      {orderedWidgets.map((widget) => (
        <div
          key={widget.id}
          className={`widget-draggable ${draggingWidget === widget.id ? "dragging" : ""}`}
          draggable
          tabIndex={0}
          aria-label={`${widgetLabel(widget, locale)}. Use Alt and arrow keys to reorder.`}
          onKeyDown={(event) => {
            if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
            event.preventDefault();
            const index = orderedWidgets.findIndex((item) => item.id === widget.id);
            const target = orderedWidgets[index + (event.key === "ArrowUp" ? -1 : 1)];
            if (target) reorder(widget.id, target.id);
          }}
          onDragStart={(event) => {
            setDraggingWidget(widget.id);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", widget.id);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          onDrop={(event) => {
            event.preventDefault();
            const sourceId = event.dataTransfer.getData("text/plain") as WidgetId;
            reorder(sourceId, widget.id);
            setDraggingWidget(null);
          }}
          onDragEnd={() => setDraggingWidget(null)}
        >
          {renderWidget(widget)}
        </div>
      ))}
    </section>
  );
}

function Toggle({ enabled, onChange, label }: { enabled: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button className="settings-toggle" aria-label={label} role="switch" aria-checked={enabled} type="button" onClick={() => onChange(!enabled)}>
      <span />
    </button>
  );
}

function SliderRow({ label, value, min, max, unit = "%", onChange }: { label: string; value: number; min: number; max: number; unit?: string; onChange: (value: number) => void }) {
  function updateValue(event: ChangeEvent<HTMLInputElement> | FormEvent<HTMLInputElement>) {
    onChange(Number(event.currentTarget.value));
  }

  return (
    <div className="settings-row">
      <span>{label}</span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        value={value}
        style={{ "--range-progress": `${((value - min) / (max - min)) * 100}%` } as CSSProperties}
        onInput={updateValue}
        onChange={updateValue}
      />
      <strong>{value}{unit}</strong>
    </div>
  );
}

function SettingsPanel({ settings, favorites, favoriteGroups, weatherLocation, widgetData, customWallpaperDataUrl, onClose, onSettingsChange, onFavoritesChange, onFavoriteGroupsChange, onCustomWallpaperChange, onImportData, onResetAll }: SettingsPanelProps) {
  useDialogFocus(".settings-shell", onClose);
  const [tab, setTab] = useState<SettingsTab>("appearance");
  const [confirmReset, setConfirmReset] = useState(false);
  const [newGroupLabel, setNewGroupLabel] = useState("");
  const [storageStatus, setStorageStatus] = useState<StorageStatus>({
    usedBytes: 0,
    quotaBytes: 10485760 + 102400,
    categories: [],
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const locale = settings.language.locale;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (tab !== "data") return;
    let cancelled = false;
    const data: StoredData = { settings, favorites, favoriteGroups, weatherLocation };
    void getStorageStatus(data, customWallpaperDataUrl).then((status) => {
      if (!cancelled) setStorageStatus(status);
    });
    return () => {
      cancelled = true;
    };
  }, [customWallpaperDataUrl, favoriteGroups, favorites, settings, tab, weatherLocation]);

  function update(patch: Partial<PikaSettings>) {
    onSettingsChange(mergeSettings({ ...settings, ...patch }));
  }

  function updateNested<K extends "visibility" | "widgets" | "language">(key: K, patch: Partial<PikaSettings[K]>) {
    update({ [key]: { ...settings[key], ...patch } } as Partial<PikaSettings>);
  }

  function handleWallpaperUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      window.alert("Please choose an image file.");
      return;
    }
    if (file.size > 2_500_000) {
      window.alert("Please choose an image smaller than 2.5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      onCustomWallpaperChange(dataUrl);
      update({ wallpaper: "custom" });
      event.target.value = "";
    };
    reader.readAsDataURL(file);
  }

  function exportSettings() {
    const payload = JSON.stringify({ version: 1, settings, favorites, favoriteGroups, weatherLocation, widgetData, profile: loadLocalProfile(), widgetOrder: loadWidgetOrder(), customWallpaperDataUrl, exportedAt: new Date().toISOString() }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "pikadesk-settings.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function importSettings(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 9_000_000) { window.alert("Please choose a settings backup smaller than 9 MB."); event.target.value = ""; return; }
    const reader = new FileReader();
    reader.onerror = () => window.alert("That settings file could not be read.");
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || "{}"));
        if (!data || typeof data !== "object" || Array.isArray(data) || !["settings", "favorites", "widgetData"].some((key) => key in data)) throw new Error("Invalid backup");
        onImportData(data);
      } catch {
        window.alert("That settings file could not be read.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function addFavoriteGroup(event: FormEvent) {
    event.preventDefault();
    const label = newGroupLabel.trim();
    if (!label) return;
    onFavoriteGroupsChange([...favoriteGroups, { id: createId("group"), label }]);
    setNewGroupLabel("");
  }

  function renameFavoriteGroup(groupId: string, label: string) {
    const trimmed = label.trim() || "Untitled";
    onFavoriteGroupsChange(favoriteGroups.map((group) => group.id === groupId ? { ...group, label: trimmed } : group));
  }

  function deleteFavoriteGroup(groupId: string) {
    if (favoriteGroups.length <= 1) return;
    const fallbackGroupId = favoriteGroups.find((group) => group.id !== groupId)?.id || favoriteGroups[0].id;
    onFavoriteGroupsChange(favoriteGroups.filter((group) => group.id !== groupId));
    onFavoritesChange(favorites.map((favorite) => favorite.groupId === groupId ? { ...favorite, groupId: fallbackGroupId } : favorite));
  }

  const wallpaperCards = [
    { id: "aurora", label: "Aurora" },
    { id: "cosmos", label: "Cosmos" },
    { id: "mountain", label: "Mountain" },
    { id: "abstract", label: "Abstract" },
    { id: "solid-dark", label: "Solid Dark" },
    { id: "gradient", label: "Gradient" },
  ] as const;

  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="settings-shell" role="dialog" aria-modal="true" aria-label="Settings">
        <aside className="settings-sidebar">
          <div className="settings-sidebar-head">
            <h2>{t(locale, "settings")}</h2>
            <button type="button" className="settings-close" onClick={onClose} aria-label="Close settings"><X size={19} /></button>
          </div>
          <nav>
            {settingsTabs.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
                <Icon size={19} />
                <span>{t(locale, settingsTabLabelKeys[id]) || label}</span>
                {tab === id && <ChevronRight size={17} />}
              </button>
            ))}
          </nav>
          <div className="settings-version">v1.0.1<br />PikaDesk · 皮卡桌面</div>
        </aside>

        <div className="settings-content">
          {tab === "appearance" && (
            <SettingsSection title={t(locale, "appearanceTitle")} subtitle={t(locale, "appearanceSubtitle")}>
              <SectionLabel>{t(locale, "themeMode")}</SectionLabel>
              <div className="settings-segment-grid">
                {[
                  { id: "dark", label: "Dark", icon: Moon },
                  { id: "light", label: "Light", icon: Sun },
                  { id: "auto", label: "Auto", icon: Monitor },
                ].map(({ id, label, icon: Icon }) => (
                  <button key={id} type="button" className={settings.themeMode === id ? "active" : ""} onClick={() => update({ themeMode: id as PikaSettings["themeMode"] })}>
                    <Icon size={24} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              <SectionLabel>{t(locale, "accentColor")}</SectionLabel>
              <div className="accent-grid">
                {(Object.keys(accentThemes) as PikaSettings["accentColor"][]).map((id) => (
                  <button key={id} type="button" className={settings.accentColor === id ? "active" : ""} onClick={() => update({ accentColor: id })}>
                    <span className={`accent-swatch accent-${id}`} style={{ "--swatch": accentThemes[id].color } as CSSProperties}>
                      {settings.accentColor === id && <Check size={24} />}
                    </span>
                    <small>{accentThemes[id].label}</small>
                  </button>
                ))}
              </div>

              <SectionLabel>{t(locale, "typography")}</SectionLabel>
              <SliderRow label={t(locale, "baseFontSize")} value={settings.fontSize} min={12} max={20} unit="px" onChange={(fontSize) => update({ fontSize })} />
              <SelectRow label={t(locale, "fontFamily")} value={settings.fontFamily} onChange={(fontFamily) => update({ fontFamily: fontFamily as PikaSettings["fontFamily"] })} options={["inter", "system", "geist"]} labels={{ inter: "Inter (Default)", system: "System UI", geist: "Geist" }} />

              <SectionLabel>{t(locale, "widgetStyle")}</SectionLabel>
              <SliderRow label={t(locale, "panelOpacity")} value={settings.panelOpacity} min={40} max={100} onChange={(panelOpacity) => update({ panelOpacity })} />
              <SliderRow label={t(locale, "settingsSize")} value={settings.settingsScale} min={85} max={110} onChange={(settingsScale) => update({ settingsScale })} />
            </SettingsSection>
          )}

          {tab === "wallpaper" && (
            <SettingsSection title={t(locale, "wallpaperTitle")} subtitle={t(locale, "wallpaperSubtitle")}>
              <div className="wallpaper-grid">
                {wallpaperCards.map((item) => (
                  <button key={item.id} type="button" className={`wallpaper-card wallpaper-preview-${item.id} ${settings.wallpaper === item.id ? "active" : ""}`} onClick={() => update({ wallpaper: item.id })}>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
              <input ref={fileInputRef} hidden type="file" accept="image/*" onChange={handleWallpaperUpload} />
              <button className={`upload-wallpaper ${settings.wallpaper === "custom" ? "active" : ""}`} type="button" onClick={() => fileInputRef.current?.click()}>
                <Upload size={18} />
                {customWallpaperDataUrl ? "Replace custom wallpaper" : "Upload custom wallpaper"}
              </button>
              <SectionLabel>Adjustments</SectionLabel>
              <SliderRow label="Blur" value={settings.wallpaperBlur} min={0} max={20} unit="px" onChange={(wallpaperBlur) => update({ wallpaperBlur })} />
              <SliderRow label="Dim overlay" value={settings.wallpaperDim} min={0} max={90} onChange={(wallpaperDim) => update({ wallpaperDim })} />
            </SettingsSection>
          )}

          {tab === "layout" && (
            <SettingsSection title={t(locale, "layoutTitle")} subtitle={t(locale, "layoutSubtitle")}>
              <SectionLabel>{t(locale, "interfaceZoom")}</SectionLabel>
              <SliderRow label={t(locale, "interfaceZoom")} value={settings.interfaceScale} min={80} max={130} onChange={(interfaceScale) => update({ interfaceScale })} />
              <SectionLabel>{t(locale, "density")}</SectionLabel>
              <Segmented value={settings.density} values={["compact", "comfortable", "spacious"]} onChange={(density) => update({ density: density as PikaSettings["density"] })} />
              <SectionLabel>{t(locale, "searchBarPosition")}</SectionLabel>
              <Segmented value={settings.searchPosition} values={["top", "center", "bottom"]} onChange={(searchPosition) => update({ searchPosition: searchPosition as PikaSettings["searchPosition"] })} />
              <SectionLabel>{t(locale, "panelVisibility")}</SectionLabel>
              <ToggleRow label={t(locale, "showGreeting")} enabled={settings.visibility.greeting} onChange={(greeting) => updateNested("visibility", { greeting })} />
              <ToggleRow label={t(locale, "showBookmarks")} enabled={settings.visibility.bookmarkGroups} onChange={(bookmarkGroups) => updateNested("visibility", { bookmarkGroups })} />
              <ToggleRow label={t(locale, "showWidgetStrip")} enabled={settings.visibility.widgetStrip} onChange={(widgetStrip) => updateNested("visibility", { widgetStrip })} />
              <ToggleRow label={t(locale, "showTopStats")} enabled={settings.visibility.topBarStats} onChange={(topBarStats) => updateNested("visibility", { topBarStats })} />
              <ToggleRow label={t(locale, "snapGrid")} enabled={settings.visibility.snapWidgets} onChange={(snapWidgets) => updateNested("visibility", { snapWidgets })} />
              <ToggleRow label={t(locale, "showShortcuts")} enabled={settings.visibility.keyboardShortcuts} onChange={(keyboardShortcuts) => updateNested("visibility", { keyboardShortcuts })} />
              <SectionLabel>{t(locale, "bookmarkManagement")}</SectionLabel>
              <div className="bookmark-management">
                {favoriteGroups.map((group) => (
                  <div className="bookmark-group-row" key={group.id}>
                    <input value={group.label} onChange={(event) => renameFavoriteGroup(group.id, event.target.value)} aria-label={`Rename ${group.label}`} />
                    <span>{favorites.filter((favorite) => (favorite.groupId || favoriteGroups[0]?.id) === group.id).length}</span>
                    <button type="button" disabled={favoriteGroups.length <= 1} onClick={() => deleteFavoriteGroup(group.id)} aria-label={`Delete ${group.label}`}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <form className="bookmark-group-add" onSubmit={addFavoriteGroup}>
                  <input value={newGroupLabel} onChange={(event) => setNewGroupLabel(event.target.value)} placeholder="New group name" />
                  <button type="submit"><Plus size={16} />Add group</button>
                </form>
              </div>
            </SettingsSection>
          )}

          {tab === "widgets" && (
            <SettingsSection title={t(locale, "widgetsTitle")} subtitle={t(locale, "widgetsSubtitle")}>
              <div className="widget-list">
                {widgetConfig.map((widget) => (
                  <div className="widget-row" key={widget.id}>
                    <div><strong>{widgetLabel(widget, locale)}</strong><span>{widgetDescription(widget, locale)}</span></div>
                    <Toggle label={widgetLabel(widget, locale)} enabled={settings.widgets[widget.id]} onChange={(enabled) => updateNested("widgets", { [widget.id]: enabled })} />
                  </div>
                ))}
              </div>
            </SettingsSection>
          )}

          {tab === "language" && (
            <SettingsSection title={t(locale, "languageTitle")} subtitle={t(locale, "languageSubtitle")}>
              <SectionLabel>{t(locale, "interfaceLanguage")}</SectionLabel>
              <div className="language-list">
                {languages.map((language) => (
                  <button key={language.code} type="button" className={settings.language.locale === language.code ? "active" : ""} onClick={() => updateNested("language", { locale: language.code })}>
                    <span>{language.code.slice(0, 2).toUpperCase()}</span>
                    <div><strong>{language.label}</strong><small>{cleanLanguageNativeNames[language.code]}</small></div>
                    {settings.language.locale === language.code && <Check size={18} />}
                  </button>
                ))}
              </div>
              <SectionLabel>{t(locale, "regionalFormats")}</SectionLabel>
              <SelectRow label="Time format" value={settings.language.timeFormat} onChange={(timeFormat) => updateNested("language", { timeFormat: timeFormat as PikaSettings["language"]["timeFormat"] })} options={["12-hour", "24-hour"]} />
              <SelectRow label="Date format" value={settings.language.dateFormat} onChange={(dateFormat) => updateNested("language", { dateFormat: dateFormat as PikaSettings["language"]["dateFormat"] })} options={["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]} />
            </SettingsSection>
          )}

          {tab === "data" && (
            <SettingsSection title={t(locale, "dataTitle")} subtitle={t(locale, "dataSubtitle")}>
              <SectionLabel>{t(locale, "sync")}</SectionLabel>
              <div className="sync-card"><Shield size={25} /><div><strong>Saved on this device</strong><span>Small preferences also use Chrome sync when available. Export a backup before moving computers.</span></div><i /></div>
              <SectionLabel>{t(locale, "exportImport")}</SectionLabel>
              <div className="data-actions">
                <button type="button" onClick={exportSettings}><Download size={19} />Export settings</button>
                <button type="button" onClick={() => importInputRef.current?.click()}><Upload size={19} />Import settings</button>
              </div>
              <input ref={importInputRef} hidden type="file" accept="application/json" onChange={importSettings} />
              <SectionLabel>{t(locale, "storage")}</SectionLabel>
              <div className="storage-card">
                <div><span>Used storage</span><strong>{formatBytes(storageStatus.usedBytes)} / {formatBytes(storageStatus.quotaBytes)}</strong></div>
                <div className="storage-track"><span style={{ width: `${Math.min(100, Math.max(0, (storageStatus.usedBytes / storageStatus.quotaBytes) * 100))}%` }} /></div>
                <p>
                  {storageStatus.categories.map((category) => (
                    <span key={category.label}><i style={{ background: category.color }} /> {category.label} {formatBytes(category.bytes)}</span>
                  ))}
                </p>
              </div>
              <SectionLabel>{t(locale, "dangerZone")}</SectionLabel>
              {confirmReset ? (
                <div className="reset-confirm">
                  <AlertCircle size={20} />
                  <span>This permanently resets PikaDesk · 皮卡桌面 settings, favorites, and custom wallpaper.</span>
                  <button type="button" onClick={onResetAll}>Reset preferences and favorites</button>
                  <button type="button" onClick={() => setConfirmReset(false)}>Cancel</button>
                </div>
              ) : (
                <button type="button" className="reset-button" onClick={() => setConfirmReset(true)}><Trash2 size={19} />Reset preferences and favorites</button>
              )}
            </SettingsSection>
          )}
        </div>
      </section>
    </div>
  );
}

function SettingsSection({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="settings-section">
      <div className="settings-heading"><h3>{title}</h3><p>{subtitle}</p></div>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h4 className="settings-label">{children}</h4>;
}

function Segmented({ value, values, labels, onChange }: { value: string; values: string[]; labels?: Record<string, string>; onChange: (value: string) => void }) {
  return (
    <div className="settings-segment-row">
      {values.map((item) => <button key={item} type="button" className={value === item ? "active" : ""} onClick={() => onChange(item)}>{labels?.[item] || item}</button>)}
    </div>
  );
}

function SelectRow({ label, value, options, labels, onChange }: { label: string; value: string; options: string[]; labels?: Record<string, string>; onChange: (value: string) => void }) {
  return (
    <label className="settings-select-row">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{labels?.[option] || option}</option>)}
      </select>
    </label>
  );
}

function ToggleRow({ label, enabled, onChange }: { label: string; enabled: boolean; onChange: (next: boolean) => void }) {
  return <div className="toggle-row"><span>{label}</span><Toggle label={label} enabled={enabled} onChange={onChange} /></div>;
}

function getPageStyle(settings: PikaSettings): PikaStyle {
  const accent = accentThemes[settings.accentColor];
  const systemLight = typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches;
  const useLightGlass = settings.themeMode === "light" || (settings.themeMode === "auto" && systemLight);
  const fontFamilies: Record<PikaSettings["fontFamily"], string> = {
    inter: "Inter, ui-sans-serif, system-ui, sans-serif",
    system: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
    geist: "\"Geist\", \"Geist Mono\", ui-sans-serif, system-ui, sans-serif",
  };
  const panelOpacity = settings.panelOpacity / 100;
  const darkSurfaceOpacity = Math.max(54, settings.panelOpacity - 14) / 100;
  const darkStrongOpacity = Math.max(68, settings.panelOpacity) / 100;
  const darkSoftOpacity = Math.max(40, settings.panelOpacity - 30) / 100;
  const lightSurfaceOpacity = Math.min(0.74, Math.max(0.58, panelOpacity - 0.18));
  const lightStrongOpacity = Math.min(0.84, Math.max(0.7, panelOpacity - 0.08));
  const lightSoftOpacity = Math.min(0.62, Math.max(0.44, panelOpacity - 0.3));
  const lightPanelShadow = "0 16px 44px rgba(15, 23, 42, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.68)";
  const darkPanelShadow = "0 18px 54px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.08)";
  return {
    "--ui-scale": settings.interfaceScale / 100,
    "--violet": accent.color,
    "--violet-soft": accent.soft,
    "--surface": useLightGlass ? `rgba(241, 245, 249, ${lightSurfaceOpacity})` : `rgba(8, 13, 25, ${panelOpacity})`,
    "--surface-soft": useLightGlass ? `rgba(248, 250, 252, ${lightSoftOpacity})` : `rgba(255, 255, 255, ${Math.max(4, settings.panelOpacity / 12) / 100})`,
    "--glass-surface": useLightGlass ? `rgba(241, 245, 249, ${lightSurfaceOpacity})` : `rgba(10, 16, 30, ${darkSurfaceOpacity})`,
    "--glass-surface-strong": useLightGlass ? `rgba(248, 250, 252, ${lightStrongOpacity})` : `rgba(10, 16, 30, ${darkStrongOpacity})`,
    "--glass-surface-soft": useLightGlass ? `rgba(241, 245, 249, ${lightSoftOpacity})` : `rgba(10, 16, 30, ${darkSoftOpacity})`,
    "--glass-border": useLightGlass ? "rgba(30, 41, 59, 0.16)" : "rgba(255, 255, 255, 0.15)",
    "--glass-highlight": useLightGlass ? "rgba(255, 255, 255, 0.64)" : "rgba(255, 255, 255, 0.08)",
    "--panel-bg": useLightGlass ? `rgba(241, 245, 249, ${lightSurfaceOpacity})` : `rgba(10, 16, 30, ${darkSurfaceOpacity})`,
    "--panel-bg-strong": useLightGlass ? `rgba(248, 250, 252, ${lightStrongOpacity})` : `rgba(10, 16, 30, ${darkStrongOpacity})`,
    "--panel-border": useLightGlass ? "rgba(30, 41, 59, 0.2)" : "rgba(255, 255, 255, 0.15)",
    "--panel-shadow": useLightGlass ? lightPanelShadow : darkPanelShadow,
    "--text-primary": useLightGlass ? "#0f172a" : "#eef5ff",
    "--text-secondary": useLightGlass ? "#334155" : "#aab6c8",
    "--text-disabled": useLightGlass ? "#94a3b8" : "#445166",
    "--accent": accent.color,
    "--accent-soft": useLightGlass ? `color-mix(in srgb, ${accent.color} 14%, rgba(248, 250, 252, 0.92))` : accent.soft,
    "--accent-border": useLightGlass ? `color-mix(in srgb, ${accent.color} 36%, transparent)` : `color-mix(in srgb, ${accent.color} 38%, transparent)`,
    "--accent-text": useLightGlass ? accent.lightText : accent.soft,
    "--wallpaper-blur": `${settings.wallpaperBlur}px`,
    "--wallpaper-dim": settings.wallpaperDim / 100,
    "--interface-scale": settings.interfaceScale / 100,
    "--settings-scale": settings.settingsScale / 100,
    fontSize: `${settings.fontSize * (settings.interfaceScale / 100)}px`,
    fontFamily: fontFamilies[settings.fontFamily],
  } as PikaStyle;
}

export default function App() {
  const pageVisible = usePageVisible();
  const prefersReducedMotion = usePrefersReducedMotion();
  const now = useClock(pageVisible);
  const { profile, saveProfile } = useLocalProfile();
  const { loaded, settings, setSettings, favorites, setFavorites, favoriteGroups, setFavoriteGroups, weatherLocation, setWeatherLocation, customWallpaperDataUrl, setCustomWallpaper, importData, resetAll } = useStoredDashboardData();
  const { widgetData, setWidgetData } = useWidgetData();
  const stats = useSystemStats(loaded && pageVisible && (settings.visibility.topBarStats || (settings.visibility.widgetStrip && settings.widgets.system)));
  const { media, runControl } = useMediaSession(loaded && pageVisible && settings.visibility.widgetStrip && settings.widgets.music);
  const overview = useDashboardOverview(widgetData, stats, settings.widgets.system);
  const [storageMessage, setStorageMessage] = useState("");
  useEffect(() => {
    const update = (event: Event) => setStorageMessage(String((event as CustomEvent).detail));
    window.addEventListener("pikanav:storage-status", update);
    return () => window.removeEventListener("pikanav:storage-status", update);
  }, []);
  useEffect(() => { document.documentElement.lang = settings.language.locale; }, [settings.language.locale]);
  const [focusMode, setFocusMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const greetingName = updateGreetingName(profile.displayName);
  const displaySettings = settings;
  const interfaceLocale: InterfaceLocale = displaySettings.language.locale;
  const taskSummary = interfaceLocale === "zh-CN" ? `${overview.openTaskCount} \u9879\u5f85\u529e` : `${overview.openTaskCount} tasks open`;
  const handleWeatherLocationResolved = useCallback((location: WeatherLocation) => setWeatherLocation(location), [setWeatherLocation]);
  const weather = useWeather(interfaceLocale, weatherLocation, handleWeatherLocationResolved, loaded && pageVisible && settings.visibility.widgetStrip && settings.widgets.weather);
  const displayProfile = { ...profile, locale: interfaceLocale };
  const greeting = useMemo(() => getDashboardGreeting(now, interfaceLocale), [interfaceLocale, now]);

  const pageClasses = [
    "pikanav-page",
    `density-${displaySettings.density}`,
    `search-${displaySettings.searchPosition}`,
    `wallpaper-${displaySettings.wallpaper}`,
    `font-${displaySettings.fontFamily}`,
    `theme-${displaySettings.themeMode}`,
    !pageVisible ? "is-hidden" : "",
    !pageVisible || prefersReducedMotion ? "performance-mode" : "",
    focusMode ? "focus-mode" : "",
  ].filter(Boolean).join(" ");

  return (
    <main className={pageClasses} style={getPageStyle(displaySettings)} aria-label="PikaDesk · 皮卡桌面 new tab dashboard">
      <div className="aurora-bg" aria-hidden="true">
        {customWallpaperDataUrl && <div className="custom-wallpaper-layer" style={{ backgroundImage: `url(${JSON.stringify(customWallpaperDataUrl)})` }} />}
      </div>
      {storageMessage && <div className="storage-status" role="status"><span>{storageMessage}</span><button type="button" aria-label="Dismiss storage message" onClick={() => setStorageMessage("")}><X size={16} /></button></div>}
      <div className="interface-stage">
      <AppTopBar
        now={now}
        stats={stats}
        settings={displaySettings}
        profile={displayProfile}
        focusMode={focusMode}
        overview={overview}
        onToggleFocus={() => setFocusMode((value) => !value)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenProfile={() => openProfileSettings(setProfileOpen)}
      />
      <div className="dashboard-layout">
        <section className="main-column">
          {displaySettings.visibility.greeting && (
            <section className="greeting" aria-label="Overview">
              <span className="brand-mark" title="Your Browser, Your Workspace.">PikaDesk · 皮卡桌面</span>
              <h1 className="localized-greeting">{interfaceLocale === "zh-CN" || interfaceLocale === "ja-JP" ? `${greeting}，` : `${greeting}, `}<strong>{greetingName}</strong></h1>
              {!focusMode && <p className="localized-greeting-stats"><span><ListTodo size={13} />{taskSummary}</span></p>}
            </section>
          )}
          <SearchHero settings={displaySettings} locale={interfaceLocale} />
          <QuickActions focusMode={focusMode} locale={interfaceLocale} onToggleFocus={() => setFocusMode((value) => !value)} />
          {!focusMode && displaySettings.visibility.bookmarkGroups && <FavoritesGrid favorites={favorites} favoriteGroups={favoriteGroups} locale={interfaceLocale} onFavoritesChange={setFavorites} />}
        </section>
        {!focusMode && displaySettings.visibility.widgetStrip && <RightWidgets now={now} stats={stats} media={media} weather={weather} settings={displaySettings} widgetData={widgetData} locale={interfaceLocale} onMediaControl={runControl} onWeatherLocationChange={setWeatherLocation} onWidgetDataChange={setWidgetData} />}
      </div>
      </div>
      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          favorites={favorites}
          favoriteGroups={favoriteGroups}
          weatherLocation={weatherLocation}
          widgetData={widgetData}
          customWallpaperDataUrl={customWallpaperDataUrl}
          onClose={() => setSettingsOpen(false)}
          onSettingsChange={setSettings}
          onFavoritesChange={setFavorites}
          onFavoriteGroupsChange={setFavoriteGroups}
          onCustomWallpaperChange={setCustomWallpaper}
          onImportData={(data) => {
            importData(data);
            if (data.widgetData) setWidgetData(data.widgetData);
            const backup = data as any;
            if (backup.profile && typeof backup.profile.displayName === "string") saveProfile({ ...profile, displayName: backup.profile.displayName.slice(0, 80), avatarDataUrl: safeImageData(backup.profile.avatarDataUrl), locale: normalizeInterfaceLocale(backup.profile.locale) });
            if (Array.isArray(backup.widgetOrder)) { try { localStorage.setItem(WIDGET_ORDER_KEY, JSON.stringify(backup.widgetOrder)); window.dispatchEvent(new Event("pikanav:widget-order")); } catch {} }
            reportStorageStatus("Settings imported.");
          }}
          onResetAll={() => {
            void resetAll();
            setSettingsOpen(false);
          }}
        />
      )}
      {profileOpen && (
        <ProfileSettingsModal
          profile={displayProfile}
          onClose={() => setProfileOpen(false)}
          onSave={(nextProfile) => {
            saveProfile(nextProfile);
            setSettings({ ...settings, language: { ...settings.language, locale: nextProfile.locale } });
            setProfileOpen(false);
          }}
        />
      )}
    </main>
  );
}
