import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Boxes,
  Camera,
  Check,
  Code2,
  ExternalLink,
  Eye,
  Gamepad2,
  HardDrive,
  HelpCircle,
  ImageIcon,
  KeyRound,
  Layers3,
  MonitorCog,
  Minus,
  Play,
  RadioTower,
  Save,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Server,
  Upload,
  UserRound,
  X,
  Terminal,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import './index.css'
import { invoke } from '@tauri-apps/api/core'
import {
  addAsset,
  deleteAsset,
  deleteProfile,
  getSettings,
  listAssets,
  listProfiles,
  saveProfile,
  saveSettings,
  startPresence,
  stopPresence,
  type AssetItem,
  type PresenceCommandPayload,
  type PresenceProfile,
  type PresenceSession,
  type StudioSettings,
  isValidButtonUrl,
  validatePresencePayload,
  getLaunchAtLoginState,
  notify,
  openExternalUrl,
  setLaunchAtLogin,
} from './tauriPresence'

type View = 'Profiles' | 'Editor' | 'Preview' | 'Settings' | 'Help'
type Preset = 'Coding' | 'Gaming' | 'Watching' | 'Custom'

type FormState = {
  clientId: string
  details: string
  state: string
  largeImage: string
  smallImage: string
  buttonOneLabel: string
  buttonOneUrl: string
  buttonTwoLabel: string
  buttonTwoUrl: string
}

type ToggleState = {
  elapsed: boolean
  buttons: boolean
  reconnect: boolean
  minimized: boolean
}

const navItems: Array<{ label: View; icon: LucideIcon }> = [
  { label: 'Profiles', icon: Layers3 },
  { label: 'Editor', icon: SlidersHorizontal },
  { label: 'Preview', icon: Eye },
  { label: 'Settings', icon: Settings },
  { label: 'Help', icon: HelpCircle },
]

const presets: Preset[] = ['Coding', 'Gaming', 'Watching', 'Custom']
const transports = ['Local IPC', 'Mock transport', 'Disabled']
const initialSpotlight = { x: 68, y: 24 }

const presetValues: Record<Preset, Partial<FormState>> = {
  Coding: {
    details: 'Building a portfolio project',
    state: 'Editing custom RPC',
    largeImage: 'presence-studio',
    smallImage: 'presence-studio-badge',
    buttonOneLabel: 'GitHub',
    buttonTwoLabel: 'Portfolio',
  },
  Gaming: {
    details: 'Tuning the neon loadout',
    state: 'Queueing ranked ideas',
    largeImage: 'arena-core',
    smallImage: 'party',
    buttonOneLabel: 'Squad',
    buttonTwoLabel: 'Stats',
  },
  Watching: {
    details: 'Watching release notes',
    state: 'Collecting inspiration',
    largeImage: 'cinema-mode',
    smallImage: 'spark',
    buttonOneLabel: 'Channel',
    buttonTwoLabel: 'Queue',
  },
  Custom: {},
}

const initialForm: FormState = {
  clientId: '1505379098929791127',
  details: 'Building a portfolio project',
  state: 'Editing custom RPC',
  largeImage: 'presence-studio',
  smallImage: 'presence-studio-badge',
  buttonOneLabel: 'GitHub',
  buttonOneUrl: 'https://github.com/redca',
  buttonTwoLabel: 'Portfolio',
  buttonTwoUrl: 'https://redca.dev',
}

const initialSettings: StudioSettings = {
  launchAtLogin: false,
  minimizeToTray: true,
  showNotifications: true,
  developerMode: false,
  rpcTransport: 'Local IPC',
  previewUsername: 'redca',
  previewAvatarDataUrl: null,
}

function App() {
  const [view, setView] = useState<View>('Editor')
  const [form, setForm] = useState<FormState>(initialForm)
  const [toggles, setToggles] = useState<ToggleState>({
    elapsed: true,
    buttons: true,
    reconnect: true,
    minimized: false,
  })
  const [profiles, setProfiles] = useState<PresenceProfile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>('profile-coding')
  const [profileName, setProfileName] = useState('Coding Portfolio')
  const [assets, setAssets] = useState<AssetItem[]>([])
  const [settings, setSettings] = useState<StudioSettings>(initialSettings)
  const [activePreset, setActivePreset] = useState<Preset>('Coding')
  const [running, setRunning] = useState(false)
  const [session, setSession] = useState<PresenceSession | null>(null)
  const [backendMessage, setBackendMessage] = useState('Loading studio backend...')
  const [commandPending, setCommandPending] = useState(false)
  const [assetDraft, setAssetDraft] = useState('neon-pulse')
  const [assetKind, setAssetKind] = useState('Large image')
  const [assetPreviewDataUrl, setAssetPreviewDataUrl] = useState<string | null>(null)

  useEffect(() => {
    async function hydrate() {
      try {
        const [nextProfiles, nextAssets, nextSettings] = await Promise.all([
          listProfiles(),
          listAssets(),
          getSettings(),
        ])
        setProfiles(nextProfiles)
        setAssets(nextAssets)
        const launchAtLogin = await getLaunchAtLoginState()
        setSettings({ ...nextSettings, launchAtLogin })
        setProfileName(nextProfiles[0]?.name ?? 'Custom Profile')
        setBackendMessage('Backend ready. Profiles, assets, and settings synced.')
      } catch (error) {
        setBackendMessage(error instanceof Error ? error.message : String(error))
      }
    }

    void hydrate()
  }, [])

  const panelStyle = useMemo(
    () =>
      ({
        '--spot-x': `${initialSpotlight.x}%`,
        '--spot-y': `${initialSpotlight.y}%`,
      }) as CSSProperties,
    [],
  )

  const payload = useMemo(() => formToPayload(form, toggles), [form, toggles])
  const validation = useMemo(
    () => validatePresencePayload(payload, settings.rpcTransport),
    [payload, settings.rpcTransport],
  )
  const selectedLargeAsset = assets.find((asset) => asset.key === form.largeImage) ?? null
  const selectedSmallAsset = assets.find((asset) => asset.key === form.smallImage) ?? null

  useEffect(() => {
    if (!running || !session?.running) return

    const timeout = window.setTimeout(() => {
      startPresence(payload, settings.rpcTransport)
        .then((nextSession) => {
          setSession(nextSession)
          setBackendMessage(`${nextSession.transport} activity updated.`)
        })
        .catch((error) => {
          setRunning(false)
          setBackendMessage(error instanceof Error ? error.message : String(error))
        })
    }, 700)

    return () => window.clearTimeout(timeout)
  }, [payload, running, session?.running, settings.rpcTransport])

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    if (field === 'details' || field === 'state') {
      setActivePreset('Custom')
    }
  }

  const selectPreset = (preset: Preset) => {
    setActivePreset(preset)
    setForm((current) => ({ ...current, ...presetValues[preset] }))
  }

  const loadProfile = (profile: PresenceProfile) => {
    setSelectedProfileId(profile.id)
    setProfileName(profile.name)
    setForm(payloadToForm(profile.payload))
    setToggles({
      elapsed: profile.payload.showElapsedTime,
      buttons: profile.payload.showButtons ?? true,
      reconnect: profile.payload.autoReconnect,
      minimized: profile.payload.startMinimized,
    })
    setActivePreset('Custom')
    setView('Editor')
    setBackendMessage(`Loaded ${profile.name}.`)
  }

  const handleSaveProfile = async () => {
    if (!validation.valid) {
      setBackendMessage(validation.errors[0])
      return
    }

    if (!profileName.trim()) {
      setBackendMessage('Profile name is required.')
      return
    }

    setCommandPending(true)
    try {
      const name = profileName.trim()
      const saved = await saveProfile(selectedProfileId, name, payload)
      setSelectedProfileId(saved.id)
      setProfileName(saved.name)
      setProfiles(await listProfiles())
      setBackendMessage(`Saved ${saved.name}.`)
      await notify('Presence Studio', `Saved profile "${saved.name}".`, settings.showNotifications)
    } catch (error) {
      setBackendMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setCommandPending(false)
    }
  }

  const handleCreateProfile = async () => {
    if (!validation.valid) {
      setBackendMessage(validation.errors[0])
      return
    }

    setCommandPending(true)
    try {
      const saved = await saveProfile(
        null,
        profileName.trim() || `Custom ${profiles.length + 1}`,
        payload,
      )
      setProfiles(await listProfiles())
      setSelectedProfileId(saved.id)
      setProfileName(saved.name)
      setBackendMessage(`Created ${saved.name}.`)
      await notify('Presence Studio', `Created profile "${saved.name}".`, settings.showNotifications)
    } catch (error) {
      setBackendMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setCommandPending(false)
    }
  }

  const handleDeleteProfile = async (id: string) => {
    setCommandPending(true)
    try {
      await deleteProfile(id)
      const nextProfiles = await listProfiles()
      setProfiles(nextProfiles)
      if (selectedProfileId === id) {
        setSelectedProfileId(nextProfiles[0]?.id ?? null)
        setProfileName(nextProfiles[0]?.name ?? 'Custom Profile')
      }
      setBackendMessage('Profile deleted.')
    } catch (error) {
      setBackendMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setCommandPending(false)
    }
  }

  const handleAddAsset = async () => {
    setCommandPending(true)
    try {
      const asset = await addAsset(assetDraft, assetKind, assetPreviewDataUrl)
      setAssets(await listAssets())
      setForm((current) => ({
        ...current,
        [asset.kind === 'Small image' ? 'smallImage' : 'largeImage']: asset.key,
      }))
      setAssetPreviewDataUrl(null)
      setBackendMessage(
        asset.previewDataUrl
          ? `Imported local preview for ${asset.key}. Upload the same image in the Discord Developer Portal for real RPC.`
          : `Saved asset key ${asset.key}. Matching keys must also exist in the Discord Developer Portal.`,
      )
    } catch (error) {
      setBackendMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setCommandPending(false)
    }
  }

  const handleDeleteAsset = async (id: string) => {
    setCommandPending(true)
    try {
      await deleteAsset(id)
      const nextAssets = await listAssets()
      setAssets(nextAssets)
      setBackendMessage('Asset deleted.')
    } catch (error) {
      setBackendMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setCommandPending(false)
    }
  }

  const handleAssetFile = async (file: File | null) => {
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setBackendMessage('Choose a PNG, JPG, WebP, or GIF image.')
      return
    }

    const dataUrl = await readFileAsDataUrl(file)
    setAssetPreviewDataUrl(dataUrl)
    setAssetDraft(file.name.replace(/\.[^/.]+$/, '') || assetDraft)
    setBackendMessage('Image loaded for local preview. Add it to save the asset key.')
  }

  const handleAvatarFile = async (file: File | null) => {
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setBackendMessage('Choose an image file for the preview avatar.')
      return
    }

    const dataUrl = await readFileAsDataUrl(file)
    await handleSettingsChange({ ...settings, previewAvatarDataUrl: dataUrl })
  }

  const handleSettingsChange = async (nextSettings: StudioSettings) => {
    let settingsToSave = nextSettings
    if (nextSettings.launchAtLogin !== settings.launchAtLogin) {
      const enabled = await setLaunchAtLogin(nextSettings.launchAtLogin)
      settingsToSave = { ...nextSettings, launchAtLogin: enabled }
    }

    setSettings(settingsToSave)
    try {
      const saved = await saveSettings(settingsToSave)
      setSettings(saved)
      setBackendMessage('Settings saved.')
    } catch (error) {
      setBackendMessage(error instanceof Error ? error.message : String(error))
    }
  }

  const handlePresenceCommand = async () => {
    if (!running && !validation.valid) {
      setBackendMessage(validation.errors[0])
      return
    }

    setCommandPending(true)
    setBackendMessage(running ? 'Stopping local presence session...' : 'Validating activity...')

    try {
      const nextSession = running
        ? await stopPresence()
        : await startPresence(payload, settings.rpcTransport)
      setSession(nextSession)
      setRunning(nextSession.running)
      setBackendMessage(
        nextSession.running
          ? `${nextSession.transport} session active. Discord preview is running.`
          : 'Presence session stopped.',
      )
      await notify(
        'Presence Studio',
        nextSession.running ? 'Discord Rich Presence is running.' : 'Discord Rich Presence stopped.',
        settings.showNotifications,
      )
    } catch (error) {
      setBackendMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setCommandPending(false)
    }
  }

  const handleOpenUrl = async (url: string) => {
    try {
      await openExternalUrl(url)
      setBackendMessage(`Opened ${url}.`)
    } catch (error) {
      setBackendMessage(error instanceof Error ? error.message : String(error))
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const target = event.currentTarget
    if (target.dataset.spotlightPending === 'true') return

    target.dataset.spotlightPending = 'true'
    const { clientX, clientY } = event

    window.requestAnimationFrame(() => {
      const rect = target.getBoundingClientRect()
      const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100))
      const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100))

      target.style.setProperty('--spot-x', `${x}%`)
      target.style.setProperty('--spot-y', `${y}%`)
      target.dataset.spotlightPending = 'false'
    })
  }

  return (
    <main className="h-screen overflow-hidden bg-black text-slate-100">
      <div className="fixed inset-0 -z-10 bg-black" />

      <section
        className="presence-shell relative h-screen w-screen overflow-hidden rounded-none border border-white/10 bg-slate-950/72 shadow-[0_28px_110px_rgba(26,12,72,0.82)] backdrop-blur-2xl"
        style={panelStyle}
        onPointerMove={handlePointerMove}
        aria-label="Presence Studio Discord Rich Presence editor"
      >
        <div className="pointer-events-none absolute inset-0 rounded-[28px] border border-violet-300/10" />
        <div className="pointer-events-none absolute inset-0 grid-texture opacity-55" />
        <div className="pointer-events-none absolute inset-0 scan-lines opacity-40" />

        <div className="relative z-10 grid h-full grid-rows-[36px_minmax(0,1fr)]">
          <WindowChrome />
          <div className="grid min-h-0 overflow-hidden lg:grid-cols-[210px_minmax(0,1fr)]">
            <Sidebar activeView={view} onViewChange={setView} />
            <TopBar activeView={view} onViewChange={setView} />

            <div className="grid min-h-0 gap-4 overflow-hidden p-3 sm:p-4 lg:grid-cols-[minmax(0,1.45fr)_330px] lg:p-5">
              <Workspace
                activePreset={activePreset}
                assetDraft={assetDraft}
                assets={assets}
                assetKind={assetKind}
                assetPreviewDataUrl={assetPreviewDataUrl}
                backendMessage={backendMessage}
                commandPending={commandPending}
                form={form}
                profileName={profileName}
                profiles={profiles}
                running={running}
                selectedProfileId={selectedProfileId}
                settings={settings}
                selectedLargeAsset={selectedLargeAsset}
                selectedSmallAsset={selectedSmallAsset}
                toggles={toggles}
                validationErrors={validation.errors}
                validationValid={validation.valid}
                view={view}
                onAddAsset={handleAddAsset}
                onAssetDraftChange={setAssetDraft}
                onAssetFileChange={handleAssetFile}
                onAssetKindChange={setAssetKind}
                onCreateProfile={handleCreateProfile}
                onDeleteProfile={handleDeleteProfile}
                onDeleteAsset={handleDeleteAsset}
                onFieldChange={updateField}
                onLoadProfile={loadProfile}
                onProfileNameChange={setProfileName}
                onPresetChange={selectPreset}
                onRunningChange={handlePresenceCommand}
                onSaveProfile={handleSaveProfile}
                onSettingsChange={handleSettingsChange}
                onOpenUrl={handleOpenUrl}
                onAvatarFileChange={handleAvatarFile}
                onToggleChange={(key) =>
                  setToggles((current) => ({ ...current, [key]: !current[key] }))
                }
                onUseAsset={(asset, slot) => {
                  setForm((current) => ({
                    ...current,
                    [slot === 'small' ? 'smallImage' : 'largeImage']: asset.key,
                  }))
                  setBackendMessage(`Applied ${asset.key} as ${slot} image.`)
                }}
              />
              <PreviewPanel
                form={form}
                running={running}
                session={session}
                settings={settings}
                largeAsset={selectedLargeAsset}
                smallAsset={selectedSmallAsset}
                showElapsed={toggles.elapsed}
                showButtons={toggles.buttons}
                onOpenUrl={handleOpenUrl}
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function WindowChrome() {
  const runWindowCommand = async (command: 'minimize_window' | 'hide_window_to_tray') => {
    if (!('__TAURI_INTERNALS__' in window)) return
    await invoke(command)
  }

  const startDrag = async () => {
    if (!('__TAURI_INTERNALS__' in window)) return
    await invoke('start_window_drag')
  }

  return (
    <div
      className="z-30 flex h-9 items-center justify-between border-b border-white/[0.06] bg-black/18 px-3 backdrop-blur-xl"
    >
      <button
        type="button"
        aria-label="Move window"
        className="h-full flex-1 cursor-move"
        onPointerDown={() => void startDrag()}
      />
      <div className="flex items-center gap-1">
        <WindowButton label="Minimize" onClick={() => void runWindowCommand('minimize_window')}>
          <Minus className="size-3.5" />
        </WindowButton>
        <WindowButton label="Hide to tray" danger onClick={() => void runWindowCommand('hide_window_to_tray')}>
          <X className="size-3.5" />
        </WindowButton>
      </div>
    </div>
  )
}

function WindowButton({
  children,
  danger = false,
  label,
  onClick,
}: {
  children: React.ReactNode
  danger?: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`grid size-7 place-items-center rounded-lg transition ${
        danger
          ? 'text-slate-300 hover:bg-rose-500/80 hover:text-white'
          : 'text-slate-400 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function Workspace(props: {
  activePreset: Preset
  assetDraft: string
  assetKind: string
  assetPreviewDataUrl: string | null
  assets: AssetItem[]
  backendMessage: string
  commandPending: boolean
  form: FormState
  profileName: string
  profiles: PresenceProfile[]
  running: boolean
  selectedProfileId: string | null
  selectedLargeAsset: AssetItem | null
  selectedSmallAsset: AssetItem | null
  settings: StudioSettings
  toggles: ToggleState
  validationErrors: string[]
  validationValid: boolean
  view: View
  onAddAsset: () => void
  onAssetDraftChange: (value: string) => void
  onAssetFileChange: (file: File | null) => void
  onAssetKindChange: (value: string) => void
  onAvatarFileChange: (file: File | null) => void
  onCreateProfile: () => void
  onDeleteAsset: (id: string) => void
  onDeleteProfile: (id: string) => void
  onFieldChange: (field: keyof FormState, value: string) => void
  onLoadProfile: (profile: PresenceProfile) => void
  onProfileNameChange: (value: string) => void
  onPresetChange: (preset: Preset) => void
  onRunningChange: () => void
  onSaveProfile: () => void
  onSettingsChange: (settings: StudioSettings) => void
  onOpenUrl: (url: string) => void
  onToggleChange: (key: keyof ToggleState) => void
  onUseAsset: (asset: AssetItem, slot: 'large' | 'small') => void
}) {
  if (props.view === 'Profiles') return <ProfilesPanel {...props} />
  if (props.view === 'Preview') return <PreviewWorkspace {...props} />
  if (props.view === 'Settings') return <SettingsPanel {...props} />
  if (props.view === 'Help') return <HelpPanel />
  return <EditorPanel {...props} />
}

function Sidebar({
  activeView,
  onViewChange,
}: {
  activeView: View
  onViewChange: (view: View) => void
}) {
  return (
    <aside className="hidden border-r border-white/10 bg-black/24 px-3 pb-6 pt-5 lg:flex lg:flex-col">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="grid size-10 place-items-center rounded-2xl border border-violet-300/25 bg-violet-500/15 shadow-[0_0_28px_rgba(139,92,246,0.38)]">
          <Activity className="size-5 text-violet-100" strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-[-0.01em] text-white">
            Presence Studio
          </p>
          <p className="text-[11px] font-medium text-violet-200/55">RPC designer</p>
        </div>
      </div>

      <nav className="space-y-1" aria-label="Primary navigation">
        {navItems.map(({ label, icon: Icon }) => (
          <button
            type="button"
            key={label}
            onClick={() => onViewChange(label)}
            className={`group flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-medium transition ${
              label === activeView
                ? 'border border-violet-300/35 bg-violet-500/22 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_22px_rgba(139,92,246,0.16)]'
                : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
            }`}
            aria-current={label === activeView ? 'page' : undefined}
          >
            <Icon className="size-4 shrink-0" strokeWidth={2} />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.045] p-3">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-45" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-300" />
          </span>
          <p className="text-[12px] font-semibold text-emerald-100">Discord connected</p>
        </div>
      </div>
    </aside>
  )
}

function TopBar({
  activeView,
  onViewChange,
}: {
  activeView: View
  onViewChange: (view: View) => void
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/20 px-4 py-3 lg:hidden">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-2xl border border-violet-300/25 bg-violet-500/15">
          <Activity className="size-4 text-violet-100" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">Presence Studio</p>
          <p className="truncate text-[11px] text-emerald-200">Discord connected</p>
        </div>
      </div>
      <div className="studio-scroll flex max-w-[58vw] shrink-0 gap-1 overflow-x-auto pb-1">
        {navItems.map(({ label, icon: Icon }) => (
          <button
            type="button"
            key={label}
            onClick={() => onViewChange(label)}
            className={`grid size-9 place-items-center rounded-xl transition ${
              label === activeView
                ? 'bg-violet-400/18 text-violet-100'
                : 'text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
            aria-label={label}
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>
    </header>
  )
}

function PanelShell({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  children,
  action,
}: {
  eyebrow: string
  title: string
  subtitle: string
  icon: LucideIcon
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="studio-scroll min-h-0 overflow-y-auto rounded-[24px] border border-white/10 bg-slate-950/48 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] sm:p-5">
      <div className="mb-4 flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200/70">
            <Icon className="size-3.5" />
            {eyebrow}
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-white sm:text-[28px]">
            {title}
          </h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-400">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function EditorPanel({
  activePreset,
  backendMessage,
  commandPending,
  form,
  profileName,
  running,
  toggles,
  validationErrors,
  validationValid,
  onFieldChange,
  onProfileNameChange,
  onPresetChange,
  onRunningChange,
  onSaveProfile,
  onToggleChange,
}: Parameters<typeof Workspace>[0]) {
  return (
    <PanelShell
      eyebrow="Safe local prototype"
      icon={MonitorCog}
      title="Rich Presence Editor"
      subtitle="Design and run custom Discord activity without user tokens."
      action={<SegmentedControl active={activePreset} onChange={onPresetChange} />}
    >
      <form className="space-y-3" onSubmit={(event) => event.preventDefault()}>
        <InputField
          label="Profile name"
          value={profileName}
          onChange={onProfileNameChange}
          placeholder="Portfolio launch"
          icon={Layers3}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <InputField label="Client ID" value={form.clientId} onChange={(value) => onFieldChange('clientId', value)} placeholder="Discord application client ID" icon={Boxes} />
          <InputField label="Large image key" value={form.largeImage} onChange={(value) => onFieldChange('largeImage', value)} placeholder="presence-studio" icon={ImageIcon} />
          <InputField label="Details" value={form.details} onChange={(value) => onFieldChange('details', value)} placeholder="Building a portfolio project" icon={Terminal} />
          <InputField label="State" value={form.state} onChange={(value) => onFieldChange('state', value)} placeholder="Editing custom RPC" icon={RadioTower} />
          <InputField label="Small image key" value={form.smallImage} onChange={(value) => onFieldChange('smallImage', value)} placeholder="presence-studio-badge" icon={Code2} />
          <div className="grid gap-3 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <InputField label="Button 1 label" value={form.buttonOneLabel} onChange={(value) => onFieldChange('buttonOneLabel', value)} placeholder="GitHub" />
            <InputField label="Button 1 URL" value={form.buttonOneUrl} onChange={(value) => onFieldChange('buttonOneUrl', value)} placeholder="https://" />
          </div>
          <div className="grid gap-3 sm:col-span-2 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <InputField label="Button 2 label" value={form.buttonTwoLabel} onChange={(value) => onFieldChange('buttonTwoLabel', value)} placeholder="Portfolio" />
            <InputField label="Button 2 URL" value={form.buttonTwoUrl} onChange={(value) => onFieldChange('buttonTwoUrl', value)} placeholder="https://" />
          </div>
        </div>

        <div className="grid gap-3 2xl:grid-cols-3">
          <Toggle label="Show elapsed time" checked={toggles.elapsed} onChange={() => onToggleChange('elapsed')} />
          <Toggle label="Show buttons" checked={toggles.buttons} onChange={() => onToggleChange('buttons')} />
          <Toggle label="Auto reconnect" checked={toggles.reconnect} onChange={() => onToggleChange('reconnect')} />
          <Toggle label="Start minimized" checked={toggles.minimized} onChange={() => onToggleChange('minimized')} />
        </div>

        {validationErrors.length > 0 ? (
          <ValidationNotice errors={validationErrors} />
        ) : (
          <div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.055] p-3 text-[12px] font-medium leading-5 text-emerald-100/85">
            Activity is ready. Local IPC uses only a Discord application Client ID, never a user token.
          </div>
        )}

        <div className="rounded-2xl border border-amber-200/15 bg-amber-300/[0.055] p-3 text-[12px] font-medium leading-5 text-amber-100/85">
          Discord identity and uploaded asset images come from the Developer Portal and Discord client. This studio can preview local art and labels, but it cannot impersonate an account or upload assets for you.
        </div>

        <div className="rounded-2xl border border-indigo-200/15 bg-indigo-300/[0.055] p-3 text-[12px] font-medium leading-5 text-indigo-100/85">
          RPC buttons are included in the activity payload when both label and URL are valid. Discord normally shows those buttons to other users viewing your activity, so they may not appear on your own profile card.
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center">
          <PrimaryButton
            running={running}
            pending={commandPending}
            disabled={!running && !validationValid}
            onClick={onRunningChange}
          />
          <button type="button" onClick={onSaveProfile} disabled={commandPending || !validationValid || !profileName.trim()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.055] px-5 text-sm font-semibold text-slate-100 transition hover:border-violet-200/30 hover:bg-white/[0.085] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
            <Save className="size-4" />
            <span className="truncate">Save Profile</span>
          </button>
          <StatusPill message={backendMessage} />
        </div>
      </form>
    </PanelShell>
  )
}

function ProfilesPanel({
  profileName,
  profiles,
  selectedProfileId,
  commandPending,
  onCreateProfile,
  onDeleteProfile,
  onLoadProfile,
  onProfileNameChange,
}: Parameters<typeof Workspace>[0]) {
  return (
    <PanelShell
      eyebrow="Profile library"
      icon={Layers3}
      title="Profiles"
      subtitle="Load, save, and organize local Rich Presence configurations."
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <InputField
          label="Profile name"
          value={profileName}
          onChange={onProfileNameChange}
          placeholder="Portfolio launch"
          icon={Layers3}
        />
        <button
          type="button"
          onClick={onCreateProfile}
          disabled={commandPending || !profileName.trim()}
          className="min-h-10 self-end rounded-2xl border border-violet-200/25 bg-violet-500/20 px-5 text-sm font-semibold text-violet-50 transition hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Create Named Profile
        </button>
      </div>
      <div className="grid gap-3">
        {profiles.map((profile) => (
          <div key={profile.id} className={`rounded-2xl border p-4 transition ${profile.id === selectedProfileId ? 'border-violet-300/35 bg-violet-400/12' : 'border-white/10 bg-black/20 hover:bg-white/[0.045]'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{profile.name}</p>
                <p className="mt-1 truncate text-[12px] text-slate-400">{profile.payload.details}</p>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-200/60">{profile.updatedAt}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => onLoadProfile(profile)} className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-[12px] font-semibold text-slate-100 hover:bg-white/[0.09]">Load</button>
                <button type="button" onClick={() => onDeleteProfile(profile.id)} className="grid size-9 place-items-center rounded-xl border border-rose-300/15 bg-rose-400/10 text-rose-100 hover:bg-rose-400/18" aria-label={`Delete ${profile.name}`}>
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </PanelShell>
  )
}

function PreviewWorkspace(props: Parameters<typeof Workspace>[0]) {
  return (
    <PanelShell eyebrow="Preview mode" icon={Eye} title="Live Preview" subtitle="Inspect the Discord activity card as fields change.">
      <div className="grid gap-4">
        <PreviewPanel
          form={props.form}
          running={props.running}
          session={null}
          settings={props.settings}
          largeAsset={props.selectedLargeAsset}
          smallAsset={props.selectedSmallAsset}
          showElapsed={props.toggles.elapsed}
          showButtons={props.toggles.buttons}
          onOpenUrl={props.onOpenUrl}
          expanded
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Client" value={props.form.clientId.slice(0, 8)} />
          <Metric label="Large key" value={props.form.largeImage} />
          <Metric label="Transport" value={props.settings.rpcTransport} />
        </div>
      </div>
    </PanelShell>
  )
}

function SettingsPanel({
  settings,
  onAvatarFileChange,
  onSettingsChange,
}: Parameters<typeof Workspace>[0]) {
  const update = (key: keyof StudioSettings, value: boolean | string | null) =>
    onSettingsChange({ ...settings, [key]: value })

  return (
    <PanelShell eyebrow="App preferences" icon={Settings} title="Settings" subtitle="Control startup behavior and backend transport mode.">
      <div className="grid gap-3">
        <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 sm:grid-cols-[1fr_auto]">
          <InputField
            label="Preview username"
            value={settings.previewUsername}
            onChange={(value) => update('previewUsername', value)}
            placeholder="redca"
            icon={Camera}
          />
          <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 self-end rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-sm font-semibold text-slate-100 transition hover:border-violet-200/30 hover:bg-white/[0.085]">
            <Upload className="size-4 shrink-0" />
            <span className="truncate">Avatar</span>
            <input
              aria-label="Import preview avatar"
              className="sr-only"
              type="file"
              accept="image/*"
              onChange={(event) => onAvatarFileChange(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <Toggle label="Launch at login" checked={settings.launchAtLogin} onChange={() => update('launchAtLogin', !settings.launchAtLogin)} />
        <Toggle label="Minimize to tray" checked={settings.minimizeToTray} onChange={() => update('minimizeToTray', !settings.minimizeToTray)} />
        <Toggle label="Show notifications" checked={settings.showNotifications} onChange={() => update('showNotifications', !settings.showNotifications)} />
        <Toggle label="Developer mode" checked={settings.developerMode} onChange={() => update('developerMode', !settings.developerMode)} />
        <div>
          <span className="mb-1.5 block text-[12px] font-semibold text-slate-300">RPC transport</span>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="RPC transport">
            {transports.map((transport) => (
              <button
                key={transport}
                type="button"
                role="radio"
                aria-checked={settings.rpcTransport === transport}
                onClick={() => update('rpcTransport', transport)}
                className={`min-h-11 rounded-2xl border px-3 text-left text-[13px] font-semibold transition ${
                  settings.rpcTransport === transport
                    ? 'border-violet-300/40 bg-violet-500/20 text-white shadow-[0_0_22px_rgba(139,92,246,0.16)]'
                    : 'border-white/10 bg-black/24 text-slate-400 hover:border-violet-200/25 hover:bg-white/[0.055] hover:text-slate-100'
                }`}
              >
                <span className="block truncate">{transport}</span>
              </button>
            ))}
          </div>
        </div>
        {settings.developerMode ? (
          <div className="rounded-2xl border border-violet-200/15 bg-violet-300/[0.055] p-4">
            <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-violet-200/70">
              <Terminal className="size-4" />
              Developer diagnostics
            </div>
            <div className="grid gap-2 text-[12px] font-medium text-slate-300">
              <DiagnosticRow label="Transport" value={settings.rpcTransport} />
              <DiagnosticRow label="Commands" value="start_presence, stop_presence, profiles, settings" />
              <DiagnosticRow label="Safety" value="Application Client ID only. User tokens are not accepted." />
              <DiagnosticRow label="Identity" value="Preview username and avatar are local display settings." />
            </div>
          </div>
        ) : null}
      </div>
    </PanelShell>
  )
}

function HelpPanel() {
  return (
    <PanelShell
      eyebrow="Getting started"
      icon={BookOpen}
      title="Help"
      subtitle="A compact guide to Discord Client IDs, RPC transport modes, profiles, assets, preview identity, and native-only settings."
    >
      <div className="grid gap-3">
        <HelpSection
          icon={KeyRound}
          title="1. Get a Discord application Client ID"
          items={[
            'Open the Discord Developer Portal and create or select an application.',
            'Copy the Application ID from the application overview.',
            'Paste that Client ID into the editor. This is the only identity value Local IPC needs.',
          ]}
          note="Client IDs identify the Discord application that owns your Rich Presence. They are not user tokens."
          actionLabel="Developer Portal"
          href="https://discord.com/developers/applications"
        />
        <HelpSection
          icon={Server}
          title="2. Start RPC with Local IPC"
          items={[
            'Choose Local IPC in Settings.',
            'Fill in the Client ID, details, state, and asset keys.',
            'Press Start Presence. The app connects through the local Discord IPC bridge and updates the activity card.',
            'Buttons are sent when their labels and URLs are valid, but Discord usually shows them to other people viewing your activity instead of on your own card.',
          ]}
          note="Local IPC is the normal desktop path for Rich Presence. It talks to the running Discord client on your machine."
        />

        <div className="grid gap-3 lg:grid-cols-3">
          <MiniHelpCard
            icon={HardDrive}
            title="Transport modes"
            lines={[
              'Local IPC: real desktop Rich Presence through the Discord client.',
              'Mock transport: a safe preview that simulates updates without touching Discord.',
              'Disabled: no transport is active, so Start Presence stays blocked.',
            ]}
          />
          <MiniHelpCard
            icon={Layers3}
            title="Profiles"
            lines={[
              'Profiles snapshot the current editor values and toggles.',
              'Load a profile to restore a saved configuration in one click.',
              'Use them to keep different setups for work, games, and experiments.',
            ]}
          />
          <MiniHelpCard
            icon={ImageIcon}
            title="Image keys"
            lines={[
              'Type large and small image keys directly in the editor.',
              'Real Discord images must be uploaded in the Developer Portal.',
              'Keys must match exactly or Discord will not resolve the image.',
            ]}
          />
        </div>

        <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
          <HelpSection
            icon={UserRound}
            title="Preview identity"
            items={[
              'Preview username and avatar are local display settings for the studio preview.',
              'Real Discord Rich Presence uses the signed-in Discord desktop account.',
              'User tokens and account impersonation are not supported.',
            ]}
            note="That boundary is deliberate: the app keeps the preview safe and avoids user-token workflows."
          />
          <HelpSection
            icon={AlertTriangle}
            title="Troubleshooting"
            items={[
              'Nothing starts: confirm Local IPC is selected and Discord is running.',
              'Image missing: make sure the asset key exists in the correct Discord application and the spelling matches exactly.',
              'Buttons fail: only valid http or https URLs are accepted.',
              'Session stops immediately: check the Client ID and any validation message in the status bar.',
            ]}
          />
        </div>

        <HelpSection
          icon={MonitorCog}
          title="Native settings"
          items={[
            'Launch at login writes the OS autostart registration.',
            'Show notifications controls native start, stop, and save alerts.',
            'Minimize to tray keeps the fixed-size desktop app alive in the tray.',
          ]}
          note="These options work in the Tauri desktop build; browser preview keeps safe local fallbacks."
        />
      </div>
    </PanelShell>
  )
}

function HelpSection({
  actionLabel,
  href,
  icon: Icon,
  items,
  note,
  title,
}: {
  actionLabel?: string
  href?: string
  icon: LucideIcon
  items: string[]
  note?: string
  title: string
}) {
  return (
    <section className="rounded-[22px] border border-white/10 bg-black/20 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-200/70">
            <Icon className="size-3.5" />
            <span className="truncate">{title}</span>
          </div>
        </div>
        {href && actionLabel ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.055] px-3 text-[12px] font-semibold text-slate-100 transition hover:border-violet-200/25 hover:bg-white/[0.085]"
          >
            <span className="truncate">{actionLabel}</span>
            <ExternalLink className="size-3.5 shrink-0" />
          </a>
        ) : null}
      </div>
      <ul className="grid gap-2 text-[13px] leading-6 text-slate-300">
        {items.map((item) => (
          <li key={item} className="rounded-xl border border-white/5 bg-white/[0.025] px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
      {note ? <p className="mt-3 text-[12px] leading-5 text-slate-500">{note}</p> : null}
    </section>
  )
}

function MiniHelpCard({
  icon: Icon,
  lines,
  title,
}: {
  icon: LucideIcon
  lines: string[]
  title: string
}) {
  return (
    <section className="rounded-[22px] border border-white/10 bg-black/20 p-4">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-200/70">
        <Icon className="size-3.5" />
        <span className="truncate">{title}</span>
      </div>
      <div className="grid gap-2 text-[13px] leading-6 text-slate-300">
        {lines.map((line) => (
          <p key={line} className="rounded-xl border border-white/5 bg-white/[0.025] px-3 py-2">
            {line}
          </p>
        ))}
      </div>
    </section>
  )
}

function DiagnosticRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-xl border border-white/10 bg-black/20 p-3 sm:grid-cols-[96px_minmax(0,1fr)]">
      <span className="text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-slate-200">{value}</span>
    </div>
  )
}

function PreviewPanel({
  form,
  largeAsset,
  onOpenUrl,
  running,
  session,
  settings,
  showButtons,
  showElapsed,
  smallAsset,
  expanded = false,
}: {
  form: FormState
  largeAsset: AssetItem | null
  onOpenUrl: (url: string) => void
  running: boolean
  session: PresenceSession | null
  settings: StudioSettings
  showButtons: boolean
  showElapsed: boolean
  smallAsset: AssetItem | null
  expanded?: boolean
}) {
  return (
    <aside className={`${expanded ? '' : 'lg:block'} studio-scroll min-h-0 overflow-y-auto rounded-[24px] border border-white/10 bg-black/30 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] sm:p-5`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold uppercase tracking-[0.16em] text-violet-200/70">Preview</p>
          <h2 className="mt-1 text-lg font-semibold tracking-[-0.01em] text-white">Discord activity</h2>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${running ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200' : 'border-slate-300/10 bg-slate-400/10 text-slate-300'}`}>
          {running ? 'Running' : 'Draft'}
        </span>
      </div>
      <DiscordCard
        form={form}
        largeAsset={largeAsset}
        session={session}
        settings={settings}
        showButtons={showButtons}
        showElapsed={showElapsed}
        smallAsset={smallAsset}
        onOpenUrl={onOpenUrl}
      />
      <div className="mt-4 rounded-2xl border border-violet-200/10 bg-violet-300/[0.055] p-3">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-violet-100">
          <ShieldCheck className="size-4 shrink-0" />
          <span className="min-w-0 truncate">{settings.rpcTransport} - Live preview updates instantly</span>
        </div>
      </div>
    </aside>
  )
}

function DiscordCard({
  form,
  largeAsset,
  onOpenUrl,
  session,
  settings,
  showButtons,
  showElapsed,
  smallAsset,
}: {
  form: FormState
  largeAsset: AssetItem | null
  onOpenUrl: (url: string) => void
  session: PresenceSession | null
  settings: StudioSettings
  showButtons: boolean
  showElapsed: boolean
  smallAsset: AssetItem | null
}) {
  const username = settings.previewUsername.trim() || 'redca'
  const previewButtons = [
    { label: form.buttonOneLabel.trim(), url: form.buttonOneUrl.trim() },
    { label: form.buttonTwoLabel.trim(), url: form.buttonTwoUrl.trim() },
  ].filter(
    (button) =>
      showButtons && button.label && [...button.label].length <= 32 && isValidButtonUrl(button.url),
  )

  return (
    <div className="discord-card rounded-[22px] border border-[#3c3f50] bg-[#2b2d36] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.35)]">
      <div className="mb-4 flex items-center gap-3">
        {settings.previewAvatarDataUrl ? (
          <img
            src={settings.previewAvatarDataUrl}
            alt=""
            className="size-10 rounded-full object-cover"
          />
        ) : (
          <div className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 text-sm font-bold text-white">
            {username.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{username}</p>
          <p className="truncate text-[12px] font-medium text-slate-300">{session?.activityLabel ?? 'Playing Presence Studio'}</p>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="relative size-[92px] shrink-0 overflow-visible">
          <AssetThumb asset={largeAsset} className="size-[92px]" />
          <div className="absolute -bottom-2 -right-2 grid size-9 place-items-center rounded-full border-[3px] border-[#2b2d36] bg-[#11131d] shadow-[0_0_18px_rgba(168,85,247,0.48)]">
            {smallAsset?.previewDataUrl ? (
              <img src={smallAsset.previewDataUrl} alt="" className="size-full rounded-full object-cover" />
            ) : (
              <Gamepad2 className="size-4 text-violet-200" />
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <p className="truncate text-[13px] font-bold text-white">Presence Studio</p>
          <p className="mt-1 truncate text-[12px] font-medium text-slate-200">{form.details || 'Building a portfolio project'}</p>
          <p className="mt-1 truncate text-[12px] text-slate-300">{form.state || 'Editing custom RPC'}</p>
          {showElapsed ? (
            <p className="mt-2 truncate text-[11px] text-slate-400">00:14 elapsed</p>
          ) : null}
        </div>
      </div>
      {previewButtons.length > 0 ? (
        <div className={`mt-4 grid gap-2 ${previewButtons.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {previewButtons.map((button) => (
            <button type="button" key={button.url} onClick={() => onOpenUrl(button.url)} className="min-h-9 min-w-0 rounded-lg bg-[#5865f2] px-3 text-[12px] font-semibold text-white transition hover:bg-[#6974f5] active:scale-[0.98]" aria-label={`Open ${button.label}`}>
              <span className="block truncate">{button.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function SegmentedControl({ active, onChange }: { active: Preset; onChange: (preset: Preset) => void }) {
  return (
    <div className="grid grid-cols-4 rounded-2xl border border-white/10 bg-black/28 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]" role="tablist" aria-label="Presence presets">
      {presets.map((preset) => (
        <button type="button" key={preset} role="tab" aria-selected={active === preset} onClick={() => onChange(preset)} className={`min-h-9 min-w-0 rounded-xl px-2 text-[12px] font-semibold transition ${active === preset ? 'bg-violet-400/20 text-violet-50 shadow-[0_0_20px_rgba(139,92,246,0.16)]' : 'text-slate-400 hover:bg-white/[0.055] hover:text-slate-100'}`}>
          <span className="block truncate">{preset}</span>
        </button>
      ))}
    </div>
  )
}

function AssetThumb({ asset, className }: { asset: AssetItem | null; className: string }) {
  if (asset?.previewDataUrl) {
    return (
      <img
        src={asset.previewDataUrl}
        alt=""
        className={`${className} rounded-[18px] border border-violet-200/20 object-cover shadow-[0_0_32px_rgba(139,92,246,0.42)]`}
      />
    )
  }

  return (
    <div className={`${className} relative rounded-[18px] border border-violet-200/20 bg-[radial-gradient(circle_at_32%_28%,rgba(255,255,255,0.42),transparent_20%),linear-gradient(135deg,#8b5cf6,#312e81_55%,#060617)] shadow-[0_0_32px_rgba(139,92,246,0.42)]`}>
      <Sparkles className="absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 text-white/75" />
    </div>
  )
}

function InputField({ label, value, onChange, placeholder, icon: Icon }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; icon?: LucideIcon }) {
  const id = label.toLowerCase().replaceAll(' ', '-')
  return (
    <label htmlFor={id} className="group block min-w-0">
      <span className="mb-1.5 block truncate text-[12px] font-semibold text-slate-300">{label}</span>
      <span className="flex h-10 items-center gap-2 rounded-2xl border border-white/10 bg-black/24 px-3 transition group-hover:border-violet-200/25 group-focus-within:border-violet-200/50 group-focus-within:bg-violet-950/20 group-focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.13)]">
        {Icon ? <Icon className="size-4 shrink-0 text-violet-200/65" /> : null}
        <input id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-slate-100 outline-none placeholder:text-slate-600" />
      </span>
    </label>
  )
}

function ValidationNotice({ errors }: { errors: string[] }) {
  return (
    <div className="rounded-2xl border border-rose-300/20 bg-rose-400/[0.075] p-3 text-[12px] font-medium leading-5 text-rose-100/90">
      <p className="font-semibold text-rose-50">Fix before Start or Save</p>
      <ul className="mt-1 grid gap-1">
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button type="button" role="switch" onClick={onChange} className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-3 text-left transition hover:border-violet-200/25 hover:bg-white/[0.07] focus-visible:border-violet-200/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/30" aria-checked={checked}>
      <span className="min-w-0 truncate text-[13px] font-semibold text-slate-200">{label}</span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full border transition ${checked ? 'border-violet-200/35 bg-violet-500 shadow-[0_0_18px_rgba(139,92,246,0.3)]' : 'border-white/10 bg-slate-800'}`}>
        <span className={`absolute top-1 grid size-4 place-items-center rounded-full bg-white text-violet-600 transition ${checked ? 'left-6' : 'left-1'}`}>
          {checked ? <Check className="size-3" strokeWidth={3} /> : null}
        </span>
      </span>
    </button>
  )
}

function PrimaryButton({
  disabled,
  running,
  pending,
  onClick,
}: {
  disabled: boolean
  running: boolean
  pending: boolean
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} disabled={pending || disabled} className={`group inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold text-white shadow-lg transition active:scale-[0.98] ${running ? 'border border-rose-300/30 bg-rose-500/22 shadow-rose-950/40 hover:bg-rose-500/30' : 'border border-violet-200/30 bg-violet-500 shadow-violet-950/50 hover:bg-violet-400'} disabled:cursor-not-allowed disabled:opacity-50`} aria-pressed={running}>
      {running ? <Square className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
      <span className="truncate">{pending ? 'Working...' : running ? 'Stop Presence' : 'Start Presence'}</span>
    </button>
  )
}

function StatusPill({ message }: { message: string }) {
  return (
    <p className="min-w-0 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-[12px] font-medium leading-5 text-slate-400 sm:ml-auto sm:max-w-[270px]">
      <span className="block sm:truncate" title={message}>{message}</span>
    </p>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

function formToPayload(form: FormState, toggles: ToggleState): PresenceCommandPayload {
  return {
    clientId: form.clientId,
    details: form.details,
    state: form.state,
    largeImageKey: form.largeImage,
    smallImageKey: form.smallImage,
    buttonOneLabel: form.buttonOneLabel,
    buttonOneUrl: form.buttonOneUrl,
    buttonTwoLabel: form.buttonTwoLabel,
    buttonTwoUrl: form.buttonTwoUrl,
    showElapsedTime: toggles.elapsed,
    showButtons: toggles.buttons,
    autoReconnect: toggles.reconnect,
    startMinimized: toggles.minimized,
  }
}

function payloadToForm(payload: PresenceCommandPayload): FormState {
  return {
    clientId: payload.clientId,
    details: payload.details,
    state: payload.state,
    largeImage: payload.largeImageKey,
    smallImage: payload.smallImageKey,
    buttonOneLabel: payload.buttonOneLabel,
    buttonOneUrl: payload.buttonOneUrl,
    buttonTwoLabel: payload.buttonTwoLabel,
    buttonTwoUrl: payload.buttonTwoUrl,
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')))
    reader.addEventListener('error', () => reject(new Error('Could not read image file.')))
    reader.readAsDataURL(file)
  })
}

export default App
