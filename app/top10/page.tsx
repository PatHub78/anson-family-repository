'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import AuthGuard from '@/app/components/AuthGuard'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const PRESET_TOPICS = [
  { key: 'movies',      label: '🎬 Movies' },
  { key: 'books',       label: '📚 Books' },
  { key: 'tv_shows',    label: '📺 TV Shows' },
  { key: 'albums',      label: '💿 Albums' },
  { key: 'songs',       label: '🎵 Songs' },
  { key: 'restaurants', label: '🍕 Restaurants' },
  { key: 'travel',      label: '✈️ Travel' },
]

function getAvatarUrl(fullName: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${fullName.toLowerCase().replaceAll(' ', '-')}.jpg`
}

function topicDisplayLabel(key: string) {
  return PRESET_TOPICS.find(t => t.key === key)?.label ?? `📋 ${key}`
}

type Profile  = { email: string; full_name: string; first_name: string }
type ListRow  = { id: string; user_email: string; topic: string }
type ItemRow  = { id: string; list_id: string; rank: number; title: string; note: string | null }
type EditItem = { title: string; note: string }

const BLANK: EditItem[] = Array.from({ length: 10 }, () => ({ title: '', note: '' }))

export default function Top10Page() {
  const [myEmail,      setMyEmail]      = useState('')
  const [profiles,     setProfiles]     = useState<Profile[]>([])
  const [topic,        setTopic]        = useState('movies')
  const [customInput,  setCustomInput]  = useState('')
  const [showCustom,   setShowCustom]   = useState(false)
  const [view,         setView]         = useState<'mine' | 'consensus' | 'everyone'>('mine')

  // My list edit state
  const [editItems,    setEditItems]    = useState<EditItem[]>(BLANK)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)

  // All data for current topic
  const [allLists,     setAllLists]     = useState<ListRow[]>([])
  const [allItems,     setAllItems]     = useState<ItemRow[]>([])
  const [loading,      setLoading]      = useState(false)

  // ── Boot ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function boot() {
      const { data: { user } } = await supabase.auth.getUser()
      setMyEmail(user?.email ?? '')
      const { data } = await supabase.from('profiles').select('email, full_name, first_name')
      setProfiles(data ?? [])
    }
    boot()
  }, [])

  // ── Load topic data ──────────────────────────────────────────────────────────
  const loadTopic = useCallback(async (t: string, email: string) => {
    if (!t || !email) return
    setLoading(true)

    const { data: lists } = await supabase
      .from('top10_lists')
      .select('*')
      .eq('topic', t)

    const listIds = (lists ?? []).map(l => l.id)
    let items: ItemRow[] = []
    if (listIds.length > 0) {
      const { data } = await supabase
        .from('top10_items')
        .select('*')
        .in('list_id', listIds)
        .order('rank', { ascending: true })
      items = data ?? []
    }

    setAllLists(lists ?? [])
    setAllItems(items)

    // Populate my edit state
    const mine = (lists ?? []).find(l => l.user_email === email)
    if (mine) {
      const myItems = items.filter(i => i.list_id === mine.id)
      setEditItems(
        Array.from({ length: 10 }, (_, i) => {
          const it = myItems.find(x => x.rank === i + 1)
          return { title: it?.title ?? '', note: it?.note ?? '' }
        })
      )
    } else {
      setEditItems(BLANK)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    if (myEmail) loadTopic(topic, myEmail)
  }, [topic, myEmail, loadTopic])

  // ── Save my list ─────────────────────────────────────────────────────────────
  async function saveList() {
    if (!myEmail || saving) return
    setSaving(true)

    const { data: listData, error } = await supabase
      .from('top10_lists')
      .upsert({ user_email: myEmail, topic }, { onConflict: 'user_email,topic' })
      .select()
      .single()

    if (error || !listData) { setSaving(false); return }

    await supabase.from('top10_items').delete().eq('list_id', listData.id)

    const toInsert = editItems
      .map((item, i) => ({
        list_id: listData.id,
        rank: i + 1,
        title: item.title.trim(),
        note: item.note.trim() || null,
      }))
      .filter(item => item.title)

    if (toInsert.length > 0) await supabase.from('top10_items').insert(toInsert)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    loadTopic(topic, myEmail)
  }

  // ── Consensus calculation ────────────────────────────────────────────────────
  function getConsensus() {
    const map: Record<string, { count: number; totalRank: number; emails: string[]; title: string }> = {}

    allItems.forEach(item => {
      const key = item.title.trim().toLowerCase()
      if (!key) return
      const list = allLists.find(l => l.id === item.list_id)
      if (!list) return
      if (!map[key]) map[key] = { count: 0, totalRank: 0, emails: [], title: item.title.trim() }
      map[key].count++
      map[key].totalRank += item.rank
      map[key].emails.push(list.user_email)
    })

    return Object.values(map)
      .filter(v => v.count > 1)
      .sort((a, b) => b.count - a.count || (a.totalRank / a.count) - (b.totalRank / b.count))
      .slice(0, 10)
      .map((v, i) => ({ ...v, rank: i + 1 }))
  }

  const consensus    = getConsensus()
  const profileFor   = (email: string) => profiles.find(p => p.email === email)
  const topicNoun    = topicDisplayLabel(topic).replace(/^[^\s]+\s/, '') // strip emoji
  const hasAnyEntry  = editItems.some(i => i.title.trim())

  // ── Confirm custom topic ──────────────────────────────────────────────────────
  function confirmCustom() {
    const val = customInput.trim().toLowerCase()
    if (!val) { setShowCustom(false); return }
    setTopic(val)
    setShowCustom(false)
    setCustomInput('')
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 pb-24">

        {/* Header */}
        <div className="bg-white border-b px-6 py-5">
          <h1 className="text-2xl font-bold text-gray-900">🏆 Top 10</h1>
          <p className="text-sm text-gray-500 mt-0.5">Everyone's favourites, ranked</p>
        </div>

        {/* Topic selector */}
        <div className="bg-white border-b px-4 py-3 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {PRESET_TOPICS.map(t => (
              <button
                key={t.key}
                onClick={() => { setTopic(t.key); setShowCustom(false) }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border whitespace-nowrap ${
                  topic === t.key && !showCustom
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t.label}
              </button>
            ))}

            {/* Custom topic */}
            {showCustom ? (
              <input
                autoFocus
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                onBlur={confirmCustom}
                onKeyDown={e => e.key === 'Enter' && confirmCustom()}
                placeholder="Topic name…"
                className="px-4 py-2 rounded-full text-sm border-2 border-indigo-400 outline-none w-36"
              />
            ) : (
              <>
                {/* Show active custom topic pill */}
                {!PRESET_TOPICS.find(t => t.key === topic) && (
                  <button
                    onClick={() => setShowCustom(true)}
                    className="px-4 py-2 rounded-full text-sm font-medium border border-indigo-600 bg-indigo-600 text-white whitespace-nowrap"
                  >
                    📋 {topic}
                  </button>
                )}
                <button
                  onClick={() => setShowCustom(true)}
                  className="px-4 py-2 rounded-full text-sm font-medium border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap"
                >
                  + Custom
                </button>
              </>
            )}
          </div>
        </div>

        {/* View tabs */}
        <div className="bg-white border-b px-4 flex">
          {([
            ['mine',      'My List'],
            ['consensus', '✨ Family Picks'],
            ['everyone',  "Everyone's"],
          ] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                view === v
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="max-w-2xl mx-auto px-4 py-6">

          {/* MY LIST */}
          {view === 'mine' && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400 mb-4">
                Your personal top 10 {topicNoun} — fill in as many as you like
              </p>
              {editItems.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm"
                >
                  <span className={`w-7 h-7 rounded-full text-xs font-black flex items-center justify-center shrink-0 mt-0.5 ${
                    i === 0 ? 'bg-yellow-400 text-yellow-900' :
                    i === 1 ? 'bg-gray-300 text-gray-700' :
                    i === 2 ? 'bg-amber-600 text-white' :
                    'bg-indigo-100 text-indigo-600'
                  }`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 space-y-1 min-w-0">
                    <input
                      value={item.title}
                      onChange={e => {
                        const next = [...editItems]
                        next[i] = { ...next[i], title: e.target.value }
                        setEditItems(next)
                      }}
                      placeholder={i === 0 ? `Your #1 ${topicNoun.toLowerCase().replace(/s$/, '')}…` : `#${i + 1}…`}
                      className="w-full text-sm font-semibold text-gray-900 placeholder-gray-300 outline-none bg-transparent"
                    />
                    <input
                      value={item.note}
                      onChange={e => {
                        const next = [...editItems]
                        next[i] = { ...next[i], note: e.target.value }
                        setEditItems(next)
                      }}
                      placeholder="Add a note (optional)"
                      className="w-full text-xs text-gray-400 placeholder-gray-300 outline-none bg-transparent"
                    />
                  </div>
                </div>
              ))}
              <button
                onClick={saveList}
                disabled={saving || !hasAnyEntry}
                className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save My List'}
              </button>
            </div>
          )}

          {/* FAMILY PICKS (consensus) */}
          {view === 'consensus' && (
            loading ? (
              <p className="text-gray-400 text-sm text-center py-12">Loading…</p>
            ) : consensus.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">🤔</div>
                <p className="text-gray-600 font-semibold text-sm mb-1">No shared favourites yet</p>
                <p className="text-gray-400 text-xs max-w-xs mx-auto">
                  Family Picks appear once at least 2 people include the same item on their lists.
                </p>
                <button
                  onClick={() => setView('mine')}
                  className="mt-4 text-indigo-600 text-sm font-medium hover:text-indigo-700"
                >
                  Add your list →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 mb-4">
                  Ranked by how many family members included them — ties broken by average rank
                </p>
                {consensus.map(item => (
                  <div key={item.title} className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
                    <span className={`w-8 h-8 rounded-full text-sm font-black flex items-center justify-center shrink-0 ${
                      item.rank === 1 ? 'bg-yellow-400 text-yellow-900' :
                      item.rank === 2 ? 'bg-gray-300 text-gray-700' :
                      item.rank === 3 ? 'bg-amber-600 text-white' :
                      'bg-gray-100 text-gray-500'
                    }`}>{item.rank}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-400">
                        On {item.count} list{item.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex -space-x-1.5 shrink-0">
                      {item.emails.map(email => {
                        const p = profileFor(email)
                        return p ? (
                          <img
                            key={email}
                            src={getAvatarUrl(p.full_name)}
                            alt={p.first_name}
                            title={p.first_name}
                            className="w-6 h-6 rounded-full object-cover border-2 border-white"
                          />
                        ) : null
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* EVERYONE'S LISTS */}
          {view === 'everyone' && (
            loading ? (
              <p className="text-gray-400 text-sm text-center py-12">Loading…</p>
            ) : allLists.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-gray-600 font-semibold text-sm mb-1">No lists yet for this topic</p>
                <button
                  onClick={() => setView('mine')}
                  className="mt-2 text-indigo-600 text-sm font-medium hover:text-indigo-700"
                >
                  Be the first →
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {allLists.map(list => {
                  const p = profileFor(list.user_email)
                  const items = allItems
                    .filter(i => i.list_id === list.id)
                    .sort((a, b) => a.rank - b.rank)
                  return (
                    <div key={list.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
                        {p && (
                          <img
                            src={getAvatarUrl(p.full_name)}
                            alt={p.first_name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        )}
                        <p className="text-sm font-bold text-gray-800 flex-1">
                          {p?.first_name ?? list.user_email}
                          {list.user_email === myEmail && (
                            <span className="text-indigo-400 font-normal text-xs ml-1.5">(you)</span>
                          )}
                        </p>
                        {list.user_email === myEmail && (
                          <button
                            onClick={() => setView('mine')}
                            className="text-xs text-indigo-500 font-medium hover:text-indigo-700"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                      <div className="divide-y divide-gray-50">
                        {items.map(item => (
                          <div key={item.id} className="flex items-start gap-3 px-4 py-2.5">
                            <span className={`text-xs font-bold w-5 text-right shrink-0 mt-0.5 ${
                              item.rank === 1 ? 'text-yellow-500' :
                              item.rank === 2 ? 'text-gray-400' :
                              item.rank === 3 ? 'text-amber-600' :
                              'text-gray-300'
                            }`}>{item.rank}</span>
                            <div className="min-w-0">
                              <p className="text-sm text-gray-800 font-medium">{item.title}</p>
                              {item.note && (
                                <p className="text-xs text-gray-400 mt-0.5 italic">"{item.note}"</p>
                              )}
                            </div>
                          </div>
                        ))}
                        {items.length === 0 && (
                          <p className="text-xs text-gray-400 px-4 py-3 text-center">Empty list</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}

        </div>
      </div>
    </AuthGuard>
  )
}
