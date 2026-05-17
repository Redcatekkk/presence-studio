import { invoke } from '@tauri-apps/api/core'
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart'
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'
import { openUrl } from '@tauri-apps/plugin-opener'

export type PresenceCommandPayload = {
  clientId: string
  details: string
  state: string
  largeImageKey: string
  smallImageKey: string
  buttonOneLabel: string
  buttonOneUrl: string
  buttonTwoLabel: string
  buttonTwoUrl: string
  showElapsedTime: boolean
  showButtons: boolean
  autoReconnect: boolean
  startMinimized: boolean
}

export type PresenceProfile = {
  id: string
  name: string
  updatedAt: string
  payload: PresenceCommandPayload
}

export type AssetItem = {
  id: string
  key: string
  kind: string
  tone: string
  previewDataUrl: string | null
}

export type StudioSettings = {
  launchAtLogin: boolean
  minimizeToTray: boolean
  showNotifications: boolean
  developerMode: boolean
  rpcTransport: string
  previewUsername: string
  previewAvatarDataUrl: string | null
}

export type PresenceSession = {
  running: boolean
  clientId: string
  details: string
  state: string
  activityLabel: string
  transport: string
}

export type ValidationResult = {
  valid: boolean
  errors: string[]
}

export const supportedTransports = ['Local IPC', 'Mock transport', 'Disabled'] as const

const isTauriRuntime = () => Boolean('__TAURI_INTERNALS__' in window)

const defaultPayload: PresenceCommandPayload = {
  clientId: '1249029374529826816',
  details: 'Building a portfolio project',
  state: 'Editing custom RPC',
  largeImageKey: 'presence-studio',
  smallImageKey: 'typescript',
  buttonOneLabel: 'GitHub',
  buttonOneUrl: 'https://github.com/redca',
  buttonTwoLabel: 'Portfolio',
  buttonTwoUrl: 'https://redca.dev',
  showElapsedTime: true,
  showButtons: true,
  autoReconnect: true,
  startMinimized: false,
}

let localProfiles: PresenceProfile[] = [
  {
    id: 'profile-coding',
    name: 'Coding Portfolio',
    updatedAt: 'Today',
    payload: defaultPayload,
  },
  {
    id: 'profile-gaming',
    name: 'Gaming Night',
    updatedAt: 'Yesterday',
    payload: {
      ...defaultPayload,
      details: 'Tuning the neon loadout',
      state: 'Queueing ranked ideas',
      largeImageKey: 'arena-core',
      smallImageKey: 'party',
    },
  },
  {
    id: 'profile-watching',
    name: 'Watch Mode',
    updatedAt: '2 days ago',
    payload: {
      ...defaultPayload,
      details: 'Watching release notes',
      state: 'Collecting inspiration',
      largeImageKey: 'cinema-mode',
      smallImageKey: 'spark',
    },
  },
]

let localAssets: AssetItem[] = [
  { id: 'asset-presence-studio', key: 'presence-studio', kind: 'Large image', tone: 'Purple core', previewDataUrl: null },
  { id: 'asset-typescript', key: 'typescript', kind: 'Small image', tone: 'Blue signal', previewDataUrl: null },
  { id: 'asset-arena-core', key: 'arena-core', kind: 'Large image', tone: 'Indigo arena', previewDataUrl: null },
  { id: 'asset-spark', key: 'spark', kind: 'Small image', tone: 'Violet spark', previewDataUrl: null },
]

let localSettings: StudioSettings = {
  launchAtLogin: false,
  minimizeToTray: true,
  showNotifications: true,
  developerMode: false,
  rpcTransport: 'Local IPC',
  previewUsername: 'redca',
  previewAvatarDataUrl: null,
}

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export function validatePresencePayload(
  payload: PresenceCommandPayload,
  transport: string,
): ValidationResult {
  const errors: string[] = []
  const clientId = payload.clientId.trim()
  const details = payload.details.trim()
  const state = payload.state.trim()

  if (!supportedTransports.includes(transport as (typeof supportedTransports)[number])) {
    errors.push('RPC transport is not supported.')
  }

  if (!clientId) {
    errors.push('Client ID is required.')
  } else if (!/^\d+$/.test(clientId)) {
    errors.push('Client ID must be a numeric Discord application ID.')
  }

  if (!details) {
    errors.push('Details are required.')
  } else if ([...details].length > 128) {
    errors.push('Details must be 128 characters or fewer.')
  }

  if (!state) {
    errors.push('State is required.')
  } else if ([...state].length > 128) {
    errors.push('State must be 128 characters or fewer.')
  }

  if (payload.showButtons) {
    for (const [label, url] of [
      [payload.buttonOneLabel.trim(), payload.buttonOneUrl.trim()],
      [payload.buttonTwoLabel.trim(), payload.buttonTwoUrl.trim()],
    ]) {
      if (!label && !url) continue

      if (!label || [...label].length > 32) {
        errors.push('Button labels must be 1-32 characters when a URL is set.')
        continue
      }

      if (!isValidButtonUrl(url)) {
        errors.push('Button URLs must start with http:// or https://.')
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
  }
}

export function isValidButtonUrl(value: string) {
  return value.startsWith('https://') || value.startsWith('http://')
}

export async function startPresence(
  payload: PresenceCommandPayload,
  transport: string,
): Promise<PresenceSession> {
  const validation = validatePresencePayload(payload, transport)
  if (!validation.valid) {
    throw new Error(validation.errors[0])
  }

  if (!isTauriRuntime()) {
    if (transport === 'Disabled') {
      throw new Error('RPC transport is disabled in Settings.')
    }

    return {
      running: true,
      clientId: payload.clientId.trim(),
      details: payload.details.trim(),
      state: payload.state.trim(),
      activityLabel: 'Playing Presence Studio',
      transport,
    }
  }

  return invoke<PresenceSession>('start_presence', { request: { payload, transport } })
}

export async function stopPresence(): Promise<PresenceSession> {
  if (!isTauriRuntime()) {
    return {
      running: false,
      clientId: '',
      details: '',
      state: '',
      activityLabel: 'Presence stopped',
      transport: 'Idle',
    }
  }

  return invoke<PresenceSession>('stop_presence')
}

export async function listProfiles(): Promise<PresenceProfile[]> {
  if (!isTauriRuntime()) {
    return localProfiles
  }

  return invoke<PresenceProfile[]>('list_profiles')
}

export async function saveProfile(
  id: string | null,
  name: string,
  payload: PresenceCommandPayload,
): Promise<PresenceProfile> {
  const validation = validatePresencePayload(payload, localSettings.rpcTransport)
  if (!validation.valid) {
    throw new Error(validation.errors[0])
  }

  if (!isTauriRuntime()) {
    const trimmedName = name.trim()
    if (!trimmedName) {
      throw new Error('Profile name is required.')
    }

    const profile: PresenceProfile = {
      id: id ?? `profile-${slugify(name)}`,
      name: trimmedName,
      updatedAt: 'Just now',
      payload,
    }
    localProfiles = [
      profile,
      ...localProfiles.filter((existing) => existing.id !== profile.id),
    ]
    return profile
  }

  return invoke<PresenceProfile>('save_profile', { id, name, payload })
}

export async function deleteProfile(id: string): Promise<void> {
  if (!isTauriRuntime()) {
    localProfiles = localProfiles.filter((profile) => profile.id !== id)
    return
  }

  return invoke('delete_profile', { id })
}

export async function listAssets(): Promise<AssetItem[]> {
  if (!isTauriRuntime()) {
    return localAssets
  }

  return invoke<AssetItem[]>('list_assets')
}

export async function addAsset(
  key: string,
  kind: string,
  previewDataUrl: string | null,
): Promise<AssetItem> {
  if (!isTauriRuntime()) {
    const assetKey = slugify(key)
    if (!assetKey) {
      throw new Error('Asset key is required.')
    }

    const asset: AssetItem = {
      id: `asset-${assetKey}`,
      key: assetKey,
      kind: kind || 'Large image',
      tone: 'Custom glow',
      previewDataUrl: previewDataUrl?.startsWith('data:image/') ? previewDataUrl : null,
    }
    localAssets = [asset, ...localAssets.filter((existing) => existing.key !== asset.key)]
    return asset
  }

  return invoke<AssetItem>('add_asset', { key, kind, previewDataUrl })
}

export async function deleteAsset(id: string): Promise<void> {
  if (!isTauriRuntime()) {
    localAssets = localAssets.filter((asset) => asset.id !== id)
    return
  }

  return invoke('delete_asset', { id })
}

export async function getSettings(): Promise<StudioSettings> {
  if (!isTauriRuntime()) {
    return localSettings
  }

  return invoke<StudioSettings>('get_settings')
}

export async function saveSettings(settings: StudioSettings): Promise<StudioSettings> {
  if (!supportedTransports.includes(settings.rpcTransport as (typeof supportedTransports)[number])) {
    throw new Error('RPC transport is not supported.')
  }

  const nextSettings = {
    ...settings,
    previewUsername: settings.previewUsername.trim() || 'redca',
    previewAvatarDataUrl: settings.previewAvatarDataUrl?.startsWith('data:image/')
      ? settings.previewAvatarDataUrl
      : null,
  }

  if (!isTauriRuntime()) {
    localSettings = nextSettings
    return localSettings
  }

  return invoke<StudioSettings>('save_settings', { settings: nextSettings })
}

export async function setLaunchAtLogin(enabled: boolean): Promise<boolean> {
  if (!isTauriRuntime()) {
    localSettings = { ...localSettings, launchAtLogin: enabled }
    return enabled
  }

  if (enabled) {
    await enable()
  } else {
    await disable()
  }

  return isEnabled()
}

export async function getLaunchAtLoginState(): Promise<boolean> {
  if (!isTauriRuntime()) return localSettings.launchAtLogin
  return isEnabled()
}

export async function notify(title: string, body: string, enabled: boolean): Promise<void> {
  if (!enabled || !isTauriRuntime()) return

  const granted = (await isPermissionGranted()) || (await requestPermission()) === 'granted'
  if (granted) {
    sendNotification({ title, body })
  }
}

export async function openExternalUrl(url: string): Promise<void> {
  if (!isValidButtonUrl(url)) {
    throw new Error('Button URL must start with http:// or https://.')
  }

  if (!isTauriRuntime()) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }

  await openUrl(url)
}
