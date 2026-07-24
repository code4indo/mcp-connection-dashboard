import fs from 'fs';

const storeContent = `'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { VirtualKeyboardPreset, BUILTIN_KEYBOARD_PRESETS } from '@/lib/virtual-keyboards'

export type Route =
  | { name: 'dashboard' }
  | { name: 'collections' }
  | { name: 'collection'; id: string }
  | { name: 'collection-settings'; id: string }
  | { name: 'editor'; documentId: string; pageNr?: number }
  | { name: 'models' }
  | { name: 'model'; id: string }
  | { name: 'jobs' }
  | { name: 'job'; id: string }
  | { name: 'datasets' }
  | { name: 'sites' }
  | { name: 'search' }
  | { name: 'projects' }
  | { name: 'project'; id: string }
  | { name: 'settings'; tab?: string }
  | { name: 'train'; type?: string }
  | { name: 'quick-recognition' }

function routeToHash(route: Route): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(route)) {
    if (key === 'name') continue
    if (value !== undefined) params.set(key, String(value))
  }
  const qs = params.toString()
  return '#/' + route.name + (qs ? '?' + qs : '')
}

function hashToRoute(hash: string): Route {
  const clean = hash.replace(/^#\\/?/, '')
  const [name, queryString] = clean.split('?')
  const params = new URLSearchParams(queryString || '')

  switch (name) {
    case 'dashboard': return { name: 'dashboard' }
    case 'collections': return { name: 'collections' }
    case 'collection': return { name: 'collection', id: params.get('id') || '' }
    case 'collection-settings': return { name: 'collection-settings', id: params.get('id') || '' }
    case 'editor': return { name: 'editor', documentId: params.get('documentId') || '', pageNr: parseInt(params.get('pageNr') || '1') }
    case 'models': return { name: 'models' }
    case 'model': return { name: 'model', id: params.get('id') || '' }
    case 'jobs': return { name: 'jobs' }
    case 'job': return { name: 'job', id: params.get('id') || '' }
    case 'datasets': return { name: 'datasets' }
    case 'sites': return { name: 'sites' }
    case 'search': return { name: 'search' }
    case 'projects': return { name: 'projects' }
    case 'project': return { name: 'project', id: params.get('id') || '' }
    case 'settings': return { name: 'settings', tab: params.get('tab') || undefined }
    case 'train': return { name: 'train', type: params.get('type') || undefined }
    case 'quick-recognition': return { name: 'quick-recognition' }
    default: return { name: 'dashboard' }
  }
}

interface AppState {
  route: Route
  navigate: (route: Route) => void
  navigateFromHistory: (route: Route) => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  language: 'en' | 'id'
  setLanguage: (lang: 'en' | 'id') => void
  commandOpen: boolean
  setCommandOpen: (open: boolean) => void

  // === Virtual Keyboards State ===
  customKeyboards: VirtualKeyboardPreset[]
  recentKeys: string[]
  favoriteKeys: string[]
  activeKeyboardId: string
  keyboardFontSize: 'sm' | 'md' | 'lg'
  keyboardFontFamily: 'serif' | 'sans' | 'mono'
  addCustomKeyboard: (keyboard: Omit<VirtualKeyboardPreset, 'id' | 'isBuiltIn'>) => string
  updateCustomKeyboard: (id: string, keyboard: Partial<VirtualKeyboardPreset>) => void
  deleteCustomKeyboard: (id: string) => void
  addRecentKey: (char: string) => void
  toggleFavoriteKey: (char: string) => void
  setActiveKeyboardId: (id: string) => void
  setKeyboardFontSize: (size: 'sm' | 'md' | 'lg') => void
  setKeyboardFontFamily: (family: 'serif' | 'sans' | 'mono') => void
  importCustomKeyboards: (keyboards: VirtualKeyboardPreset[]) => void
}

let isPopNavigating = false

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      route: { name: 'dashboard' },
      navigate: (route) => {
        if (typeof window !== 'undefined' && !isPopNavigating) {
          const hash = routeToHash(route)
          if (window.location.hash !== hash) {
            window.history.pushState({ route }, '', hash)
          }
        }
        isPopNavigating = false
        set({ route })
      },
      navigateFromHistory: (route) => {
        isPopNavigating = true
        set({ route })
      },
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      language: 'en',
      setLanguage: (language) => set({ language }),
      commandOpen: false,
      setCommandOpen: (commandOpen) => set({ commandOpen }),

      // === Virtual Keyboards Defaults & Actions ===
      customKeyboards: [],
      recentKeys: ['ſ', 'æ', 'œ', 'ꝓ', 'ꝑ', 'ā', 'ē', 'ī', 'ō', 'ū', 'é', 'ê', '°', '¶', '†'],
      favoriteKeys: ['ſ', 'æ', 'œ', 'ꝓ', 'ā', 'ē'],
      activeKeyboardId: 'historical-latin',
      keyboardFontSize: 'md',
      keyboardFontFamily: 'serif',

      addCustomKeyboard: (keyboardData) => {
        const id = 'custom-' + Date.now()
        const newKeyboard: VirtualKeyboardPreset = {
          ...keyboardData,
          id,
          isBuiltIn: false,
        }
        set((s) => ({
          customKeyboards: [...s.customKeyboards, newKeyboard],
          activeKeyboardId: id,
        }))
        return id
      },

      updateCustomKeyboard: (id, updateData) => {
        set((s) => ({
          customKeyboards: s.customKeyboards.map((k) => (k.id === id ? { ...k, ...updateData } : k)),
        }))
      },

      deleteCustomKeyboard: (id) => {
        set((s) => ({
          customKeyboards: s.customKeyboards.filter((k) => k.id !== id),
          activeKeyboardId: s.activeKeyboardId === id ? 'historical-latin' : s.activeKeyboardId,
        }))
      },

      addRecentKey: (char) => {
        if (!char) return
        set((s) => {
          const filtered = s.recentKeys.filter((k) => k !== char)
          return { recentKeys: [char, ...filtered].slice(0, 20) }
        })
      },

      toggleFavoriteKey: (char) => {
        if (!char) return
        set((s) => {
          const exists = s.favoriteKeys.includes(char)
          return {
            favoriteKeys: exists
              ? s.favoriteKeys.filter((k) => k !== char)
              : [...s.favoriteKeys, char],
          }
        })
      },

      setActiveKeyboardId: (activeKeyboardId) => set({ activeKeyboardId }),
      setKeyboardFontSize: (keyboardFontSize) => set({ keyboardFontSize }),
      setKeyboardFontFamily: (keyboardFontFamily) => set({ keyboardFontFamily }),

      importCustomKeyboards: (importedKeyboards) => {
        set((s) => {
          const existingIds = new Set(s.customKeyboards.map((k) => k.id))
          const validImported = importedKeyboards.filter((k) => k.name && Array.isArray(k.keys))
          const sanitized = validImported.map((k, idx) => ({
            ...k,
            id: k.id && !existingIds.has(k.id) ? k.id : 'custom-' + Date.now() + '-' + idx,
            isBuiltIn: false,
            category: 'custom' as const,
          }))
          return {
            customKeyboards: [...s.customKeyboards, ...sanitized],
          }
        })
      },
    }),
    {
      name: "anri-htr-app",
      partialize: (s) => ({
        language: s.language,
        sidebarCollapsed: s.sidebarCollapsed,
        customKeyboards: s.customKeyboards,
        recentKeys: s.recentKeys,
        favoriteKeys: s.favoriteKeys,
        activeKeyboardId: s.activeKeyboardId,
        keyboardFontSize: s.keyboardFontSize,
        keyboardFontFamily: s.keyboardFontFamily,
      }),
    }
  )
)

if (typeof window !== 'undefined') {
  const initialHash = window.location.hash
  if (initialHash) {
    const route = hashToRoute(initialHash)
    useAppStore.getState().navigateFromHistory(route)
  } else {
    const { route } = useAppStore.getState()
    window.history.replaceState({ route }, '', routeToHash(route))
  }

  window.addEventListener('popstate', () => {
    const hash = window.location.hash
    if (hash) {
      const route = hashToRoute(hash)
      useAppStore.getState().navigateFromHistory(route)
    } else {
      useAppStore.getState().navigateFromHistory({ name: 'dashboard' })
    }
  })
}
`;

async function main() {
  const res = await fetch('http://localhost:3000/api/mcp/call-tool', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'ssh_write_file',
      arguments: {
        server: 'lambda-workstation',
        path: '/media/lambda_one/DFSSD04/project/htr/src/lib/store.ts',
        content: storeContent,
      }
    })
  });
  const data = await res.json();
  console.log('Update result:', data);
}

main();
