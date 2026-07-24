import fs from 'fs';

const panelComponent = `'use client'

import { useState, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { BUILTIN_KEYBOARD_PRESETS, getUnicodeName, getUnicodeCodePoint, VirtualKey } from '@/lib/virtual-keyboards'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Star,
  X,
  History,
  Keyboard,
  Maximize2,
  Minimize2,
  Type,
  Plus,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface VirtualKeyboardPanelProps {
  onInsertChar: (char: string) => void
  onClose?: () => void
  className?: string
}

export function VirtualKeyboardPanel({ onInsertChar, onClose, className }: VirtualKeyboardPanelProps) {
  const {
    customKeyboards,
    recentKeys,
    favoriteKeys,
    activeKeyboardId,
    keyboardFontSize,
    keyboardFontFamily,
    addRecentKey,
    toggleFavoriteKey,
    setActiveKeyboardId,
    setKeyboardFontSize,
    setKeyboardFontFamily,
  } = useAppStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>('all')
  const [isExpanded, setIsExpanded] = useState(false)

  // Combine built-in and custom keyboards
  const allKeyboards = useMemo(() => {
    return [...BUILTIN_KEYBOARD_PRESETS, ...customKeyboards]
  }, [customKeyboards])

  // Get active keyboard preset or all keys
  const currentKeyboard = useMemo(() => {
    return allKeyboards.find((k) => k.id === activeKeyboardId) || BUILTIN_KEYBOARD_PRESETS[0]
  }, [allKeyboards, activeKeyboardId])

  // Get all unique keys across all active keyboards
  const displayedKeys = useMemo(() => {
    let keysSource: VirtualKey[] = []

    if (activeCategoryTab === 'favorites') {
      keysSource = favoriteKeys.map((char) => ({
        char,
        tooltip: getUnicodeName(char),
        codePoint: getUnicodeCodePoint(char),
      }))
    } else if (activeCategoryTab === 'all') {
      const map = new Map<string, VirtualKey>()
      allKeyboards.forEach((kb) => {
        kb.keys.forEach((k) => {
          if (!map.has(k.char)) map.set(k.char, k)
        })
      })
      keysSource = Array.from(map.values())
    } else {
      const filteredKeyboards = allKeyboards.filter((kb) => kb.category === activeCategoryTab || kb.id === activeCategoryTab)
      const map = new Map<string, VirtualKey>()
      filteredKeyboards.forEach((kb) => {
        kb.keys.forEach((k) => {
          if (!map.has(k.char)) map.set(k.char, k)
        })
      })
      keysSource = Array.from(map.values())
    }

    if (!searchQuery.trim()) return keysSource

    const q = searchQuery.toLowerCase().trim()
    return keysSource.filter((k) => {
      const name = (k.tooltip || getUnicodeName(k.char)).toLowerCase()
      const cp = (k.codePoint || getUnicodeCodePoint(k.char)).toLowerCase()
      return k.char.toLowerCase().includes(q) || name.includes(q) || cp.includes(q)
    })
  }, [allKeyboards, activeCategoryTab, favoriteKeys, searchQuery])

  const handleKeyClick = (char: string) => {
    addRecentKey(char)
    onInsertChar(char)
  }

  const getFontFamilyClass = () => {
    switch (keyboardFontFamily) {
      case 'sans': return 'font-sans'
      case 'mono': return 'font-mono'
      default: return 'font-serif'
    }
  }

  const getKeySizeClass = () => {
    switch (keyboardFontSize) {
      case 'sm': return 'h-7 min-w-7 text-xs p-1'
      case 'lg': return 'h-10 min-w-10 text-lg p-1.5'
      default: return 'h-8.5 min-w-8.5 text-base p-1'
    }
  }

  return (
    <div
      className={cn(
        'border-b border-border bg-card/95 backdrop-blur-sm shadow-sm transition-all duration-200 select-none',
        className
      )}
    >
      {/* Header controls & tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-b border-border/60 bg-muted/30">
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar text-xs">
          <Badge variant="outline" className="gap-1 font-semibold text-[10px] px-1.5 py-0.5 bg-primary/5 text-primary border-primary/20">
            <Keyboard className="w-3 h-3" />
            VIRTUAL KEYBOARD
          </Badge>

          {/* Preset Selector */}
          <button
            onClick={() => { setActiveCategoryTab('all'); setActiveKeyboardId('all') }}
            className={cn(
              'px-2 py-1 rounded-md transition-colors text-xs font-medium whitespace-nowrap',
              activeCategoryTab === 'all'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            All Glyphs
          </button>

          {BUILTIN_KEYBOARD_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                setActiveKeyboardId(preset.id)
                setActiveCategoryTab(preset.category)
              }}
              className={cn(
                'px-2 py-1 rounded-md transition-colors text-xs font-medium whitespace-nowrap',
                activeKeyboardId === preset.id && activeCategoryTab !== 'favorites'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {preset.name}
            </button>
          ))}

          {customKeyboards.map((custom) => (
            <button
              key={custom.id}
              onClick={() => {
                setActiveKeyboardId(custom.id)
                setActiveCategoryTab(custom.id)
              }}
              className={cn(
                'px-2 py-1 rounded-md transition-colors text-xs font-medium whitespace-nowrap border border-primary/20',
                activeKeyboardId === custom.id
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {custom.name}
            </button>
          ))}

          <button
            onClick={() => setActiveCategoryTab('favorites')}
            className={cn(
              'px-2 py-1 rounded-md transition-colors text-xs font-medium whitespace-nowrap flex items-center gap-1',
              activeCategoryTab === 'favorites'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-amber-600 hover:bg-amber-500/10'
            )}
          >
            <Star className="w-3 h-3 fill-current" />
            Favorites ({favoriteKeys.length})
          </button>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Search Bar */}
          <div className="relative w-32 sm:w-44">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search glyph or Unicode..."
              className="h-6 text-xs pl-7 pr-5 bg-background"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Font switcher */}
          <div className="flex items-center border border-border rounded-md bg-background p-0.5 text-[10px]">
            <button
              onClick={() => setKeyboardFontFamily('serif')}
              className={cn('px-1.5 py-0.5 rounded font-serif', keyboardFontFamily === 'serif' && 'bg-accent text-accent-foreground font-semibold')}
              title="Serif font"
            >
              Serif
            </button>
            <button
              onClick={() => setKeyboardFontFamily('sans')}
              className={cn('px-1.5 py-0.5 rounded font-sans', keyboardFontFamily === 'sans' && 'bg-accent text-accent-foreground font-semibold')}
              title="Sans font"
            >
              Sans
            </button>
            <button
              onClick={() => setKeyboardFontFamily('mono')}
              className={cn('px-1.5 py-0.5 rounded font-mono', keyboardFontFamily === 'mono' && 'bg-accent text-accent-foreground font-semibold')}
              title="Monospace font"
            >
              Mono
            </button>
          </div>

          {/* Key Size Switcher */}
          <div className="hidden sm:flex items-center border border-border rounded-md bg-background p-0.5 text-[10px]">
            <button
              onClick={() => setKeyboardFontSize('sm')}
              className={cn('px-1 py-0.5 rounded', keyboardFontSize === 'sm' && 'bg-accent text-accent-foreground font-semibold')}
              title="Compact keys"
            >
              S
            </button>
            <button
              onClick={() => setKeyboardFontSize('md')}
              className={cn('px-1 py-0.5 rounded', keyboardFontSize === 'md' && 'bg-accent text-accent-foreground font-semibold')}
              title="Normal keys"
            >
              M
            </button>
            <button
              onClick={() => setKeyboardFontSize('lg')}
              className={cn('px-1 py-0.5 rounded', keyboardFontSize === 'lg' && 'bg-accent text-accent-foreground font-semibold')}
              title="Large keys"
            >
              L
            </button>
          </div>

          {/* Expand/Collapse */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            title={isExpanded ? 'Collapse height' : 'Expand height'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="Close Virtual Keyboard (Alt + K)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Quick Access Bar: Recent & Favorites */}
      {(recentKeys.length > 0 || favoriteKeys.length > 0) && !searchQuery && (
        <div className="flex flex-wrap items-center gap-1 px-3 py-1 bg-accent/20 border-b border-border/40 text-xs">
          {recentKeys.length > 0 && (
            <div className="flex items-center gap-1 mr-3 pr-3 border-r border-border/50">
              <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                <History className="w-2.5 h-2.5" />
                RECENT:
              </span>
              <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar">
                {recentKeys.slice(0, 10).map((char, i) => (
                  <button
                    key={\`recent-\${i}-\${char}\`}
                    onClick={() => handleKeyClick(char)}
                    className={cn(
                      'px-1.5 py-0.5 rounded border border-border/60 bg-background hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all text-xs font-semibold',
                      getFontFamilyClass()
                    )}
                    title={\`Insert \${char} (\${getUnicodeName(char)})\`}
                  >
                    {char}
                  </button>
                ))}
              </div>
            </div>
          )}

          {favoriteKeys.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-amber-600 font-medium flex items-center gap-0.5">
                <Star className="w-2.5 h-2.5 fill-current" />
                FAVORITES:
              </span>
              <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar">
                {favoriteKeys.map((char, i) => (
                  <button
                    key={\`fav-\${i}-\${char}\`}
                    onClick={() => handleKeyClick(char)}
                    className={cn(
                      'px-1.5 py-0.5 rounded border border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/30 hover:bg-amber-100 hover:border-amber-400 text-xs font-semibold text-amber-900 dark:text-amber-200 transition-all',
                      getFontFamilyClass()
                    )}
                    title={\`Insert \${char} (\${getUnicodeName(char)})\`}
                  >
                    {char}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Character Keys Grid */}
      <div
        className={cn(
          'p-2 overflow-y-auto transition-all duration-200',
          isExpanded ? 'max-h-64' : 'max-h-36'
        )}
      >
        {displayedKeys.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No characters found matching "{searchQuery}"
          </div>
        ) : (
          <div className="flex flex-wrap gap-1 items-center">
            {displayedKeys.map((k) => {
              const isFav = favoriteKeys.includes(k.char)
              const tooltipName = k.tooltip || getUnicodeName(k.char)
              const codePoint = k.codePoint || getUnicodeCodePoint(k.char)

              return (
                <div key={k.char} className="relative group">
                  <button
                    onClick={() => handleKeyClick(k.char)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      toggleFavoriteKey(k.char)
                    }}
                    className={cn(
                      'rounded-md border border-border bg-background hover:bg-primary/10 hover:border-primary/50 hover:scale-105 active:scale-95 transition-all shadow-2xs flex items-center justify-center font-medium relative',
                      getFontFamilyClass(),
                      getKeySizeClass(),
                      isFav && 'border-amber-400/80 bg-amber-50/30 dark:bg-amber-950/20'
                    )}
                    title={\`\${k.char} - \${tooltipName} (\${codePoint})\nLeft-click to insert, Right-click to toggle favorite\`}
                  >
                    <span>{k.char}</span>
                    {isFav && (
                      <span className="absolute -top-1 -right-1 text-[8px] text-amber-500">
                        ★
                      </span>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1 bg-muted/20 border-t border-border/40 text-[10px] text-muted-foreground flex items-center justify-between">
        <span>Click glyph to insert at cursor position. Right-click to add to Favorites.</span>
        <span className="font-mono text-[9px] text-muted-foreground/70">Shortcut: <kbd className="px-1 py-0.2 rounded bg-muted border border-border">Alt + K</kbd></span>
      </div>
    </div>
  )
}
`;

const settingsComponent = `'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { BUILTIN_KEYBOARD_PRESETS, getUnicodeName, getUnicodeCodePoint, VirtualKeyboardPreset } from '@/lib/virtual-keyboards'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Keyboard, Plus, Trash2, Edit3, Download, Upload, RefreshCw, Check, Star, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

export function VirtualKeyboardSettings() {
  const {
    customKeyboards,
    addCustomKeyboard,
    updateCustomKeyboard,
    deleteCustomKeyboard,
    importCustomKeyboards,
    favoriteKeys,
    toggleFavoriteKey,
  } = useAppStore()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formChars, setFormChars] = useState('')

  const handleOpenCreate = () => {
    setEditingId(null)
    setFormName('')
    setFormDesc('')
    setFormChars('ſ æ œ ꝓ ꝑ ā ē ī ō ū')
    setDialogOpen(true)
  }

  const handleOpenEdit = (kb: VirtualKeyboardPreset) => {
    setEditingId(kb.id)
    setFormName(kb.name)
    setFormDesc(kb.description)
    setFormChars(kb.keys.map((k) => k.char).join(' '))
    setDialogOpen(true)
  }

  const handleSaveKeyboard = () => {
    if (!formName.trim()) {
      toast.error('Please enter a name for the keyboard')
      return
    }

    // Extract unique characters from character string
    const rawChars = formChars.split(/\\s+/).join('')
    const charArray = Array.from(new Set(Array.from(rawChars))).filter((c) => c.trim().length > 0)

    if (charArray.length === 0) {
      toast.error('Please enter at least one character')
      return
    }

    const keys = charArray.map((char) => ({
      char,
      tooltip: getUnicodeName(char),
      codePoint: getUnicodeCodePoint(char),
    }))

    if (editingId) {
      updateCustomKeyboard(editingId, {
        name: formName.trim(),
        description: formDesc.trim(),
        keys,
      })
      toast.success('Custom virtual keyboard updated')
    } else {
      addCustomKeyboard({
        name: formName.trim(),
        description: formDesc.trim() || 'Custom user keyboard preset',
        category: 'custom',
        keys,
      })
      toast.success('New custom virtual keyboard created')
    }

    setDialogOpen(false)
  }

  const handleExportJSON = () => {
    const exportData = JSON.stringify(customKeyboards, null, 2)
    const blob = new Blob([exportData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = \`anri-virtual-keyboards-\${Date.now()}.json\`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Exported custom keyboards as JSON')
  }

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string)
        if (Array.isArray(parsed)) {
          importCustomKeyboards(parsed)
          toast.success(\`Imported \${parsed.length} custom keyboard(s)\`)
        } else {
          toast.error('Invalid JSON file format')
        }
      } catch (err) {
        toast.error('Failed to parse JSON file')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-primary" />
              Virtual Keyboards Management
            </CardTitle>
            <CardDescription>
              Configure built-in and custom virtual keyboard layouts for special characters, ligatures, and historical scripts used in document transcription.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleExportJSON} disabled={customKeyboards.length === 0} className="gap-1 text-xs">
              <Download className="w-3.5 h-3.5" />
              Export JSON
            </Button>
            <label>
              <Button size="sm" variant="outline" asChild className="gap-1 text-xs cursor-pointer">
                <span>
                  <Upload className="w-3.5 h-3.5" />
                  Import
                </span>
              </Button>
              <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
            </label>
            <Button size="sm" onClick={handleOpenCreate} className="gap-1 text-xs">
              <Plus className="w-3.5 h-3.5" />
              New Keyboard
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Custom Keyboards Section */}
          {customKeyboards.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" />
                Custom Virtual Keyboards ({customKeyboards.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customKeyboards.map((kb) => (
                  <div key={kb.id} className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-sm flex items-center gap-2">
                          {kb.name}
                          <Badge variant="outline" className="text-[10px] bg-background">Custom</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{kb.description}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleOpenEdit(kb)}>
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => {
                          deleteCustomKeyboard(kb.id)
                          toast.success('Custom keyboard deleted')
                        }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Key chips preview */}
                    <div className="flex flex-wrap gap-1 p-2 rounded bg-background border border-border/60 max-h-24 overflow-y-auto">
                      {kb.keys.map((k, i) => (
                        <span key={i} className="inline-flex items-center justify-center w-7 h-7 rounded border border-border bg-muted/40 font-serif text-sm" title={getUnicodeName(k.char)}>
                          {k.char}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Built-in Presets Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Built-in Presets</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {BUILTIN_KEYBOARD_PRESETS.map((kb) => (
                <div key={kb.id} className="p-4 rounded-lg border border-border bg-card space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm flex items-center gap-2">
                        {kb.name}
                        <Badge variant="secondary" className="text-[10px]">Built-in</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{kb.description}</p>
                    </div>
                  </div>

                  {/* Key chips preview */}
                  <div className="flex flex-wrap gap-1 p-2 rounded bg-muted/30 border border-border/60 max-h-28 overflow-y-auto">
                    {kb.keys.map((k, i) => (
                      <span key={i} className="inline-flex items-center justify-center w-7 h-7 rounded border border-border/80 bg-background font-serif text-sm hover:border-primary/50 transition-colors" title={\`\${k.char} - \${getUnicodeName(k.char)}\`}>
                        {k.char}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Custom Keyboard' : 'Create Custom Virtual Keyboard'}</DialogTitle>
            <DialogDescription>
              Define custom characters and special symbols for transcription.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="kb-name">Keyboard Title</Label>
              <Input
                id="kb-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Dutch Colonial VOC Symbols"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb-desc">Description</Label>
              <Input
                id="kb-desc"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Brief description of manuscript characters"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb-chars">Characters List (paste characters or type separated by space)</Label>
              <Textarea
                id="kb-chars"
                value={formChars}
                onChange={(e) => setFormChars(e.target.value)}
                rows={4}
                className="font-serif text-base"
                placeholder="ſ æ œ ꝓ ꝑ ā ē ī ō ū"
              />
              <p className="text-[11px] text-muted-foreground">
                All unique characters will be automatically converted into interactive virtual keys with Unicode tooltips.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveKeyboard}>
              {editingId ? 'Update Keyboard' : 'Create Keyboard'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
`;

async function createComponents() {
  const panelRes = await fetch('http://localhost:3000/api/mcp/call-tool', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'ssh_write_file',
      arguments: {
        server: 'lambda-workstation',
        path: '/media/lambda_one/DFSSD04/project/htr/src/components/virtual-keyboard/virtual-keyboard-panel.tsx',
        content: panelComponent,
      }
    })
  });
  console.log('Write panel component:', await panelRes.json());

  const settingsRes = await fetch('http://localhost:3000/api/mcp/call-tool', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'ssh_write_file',
      arguments: {
        server: 'lambda-workstation',
        path: '/media/lambda_one/DFSSD04/project/htr/src/components/virtual-keyboard/virtual-keyboard-settings.tsx',
        content: settingsComponent,
      }
    })
  });
  console.log('Write settings component:', await settingsRes.json());
}

createComponents();
