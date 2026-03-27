'use client'

// app/jokes/page.tsx
import { useEffect, useState } from 'react'
import JokeCard from '../components/jokes/JokeCard'
import RecordModal from '../components/jokes/RecordModal'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'knock_knock', label: 'Knock Knock' },
  { key: 'one_liner', label: 'One-Liners' },
  { key: 'guy_walks_in', label: 'Guy Walks Into a Bar' },
  { key: 'other', label: 'Other' },
]

type Profile = {
  id: string
  full_name: string
  avatar_url: string
}

type Joke = {
  id: string
  user_id: string
  title: string
  category: string
  audio_url: string
  created_at: string
  profiles: Profile
}

export default function JokesPage() {
  const supabase = createClientComponentClient()
  const [jokes, setJokes] = useState<Joke[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState('all')
  const [activeProfile, setActiveProfile] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingJoke, setEditingJoke] = useState<Joke | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user?.id ?? null)

    const { data: jokesData } = await supabase
      .from('jokes')
      .select('*, profiles(id, full_name, avatar_url)')
      .order('created_at', { ascending: false })

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')

    setJokes(jokesData ?? [])
    setProfiles(profilesData ?? [])
    setLoading(false)
  }

  function getFilteredJokes() {
    return jokes.filter(j => {
      const catMatch = activeCategory === 'all' || j.category === activeCategory
      const profileMatch = !activeProfile || j.user_id === activeProfile
      return catMatch && profileMatch
    })
  }

  function getJokesByCategory() {
    const filtered = getFilteredJokes()
    if (activeCategory !== 'all') {
      return { [activeCategory]: filtered }
    }
    const grouped: Record<string, Joke[]> = {}
    for (const cat of CATEGORIES.slice(1)) {
      const items = filtered.filter(j => j.category === cat.key)
      if (items.length > 0) grouped[cat.key] = items
    }
    return grouped
  }

  async function handleDelete(id: string, audioUrl: string) {
    // Extract storage path from URL
    const path = audioUrl.split('/joke-audio/')[1]
    if (path) await supabase.storage.from('joke-audio').remove([path])
    await supabase.from('jokes').delete().eq('id', id)
    setJokes(prev => prev.filter(j => j.id !== id))
  }

  function handleReRecord(joke: Joke) {
    setEditingJoke(joke)
    setShowModal(true)
  }

  async function handleSave(joke: Joke) {
    setJokes(prev =>
      editingJoke
        ? prev.map(j => j.id === joke.id ? joke : j)
        : [joke, ...prev]
    )
    setShowModal(false)
    setEditingJoke(null)
    // Refetch to get joined profile data
    fetchAll()
  }

  const grouped = getJokesByCategory()

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b px-6 py-5">
        <h1 className="text-2xl font-bold text-gray-900">🎤 Jokes</h1>
        <p className="text-sm text-gray-500 mt-0.5">Guy walks into a bar...</p>
      </div>

      {/* Category tabs */}
      <div className="bg-white border-b px-6 overflow-x-auto">
        <div className="flex gap-1 py-2 min-w-max">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap
                ${activeCategory === cat.key
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Profile filter */}
      <div className="px-6 py-3 flex gap-2 overflow-x-auto bg-white border-b">
        <button
          onClick={() => setActiveProfile(null)}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors
            ${!activeProfile ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
        >
          Everyone
        </button>
        {profiles.map(p => (
          <button
            key={p.id}
            onClick={() => setActiveProfile(prev => prev === p.id ? null : p.id)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors
              ${activeProfile === p.id ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
          >
            {p.avatar_url && (
              <img src={p.avatar_url} className="w-4 h-4 rounded-full object-cover" />
            )}
            {p.full_name.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Jokes */}
      <div className="px-6 py-6 space-y-8">
        {loading ? (
          <p className="text-gray-400 text-sm">Loading jokes...</p>
        ) : Object.keys(grouped).length === 0 ? (
          <p className="text-gray-400 text-sm">No jokes yet — be the first!</p>
        ) : (
          Object.entries(grouped).map(([catKey, items]) => (
            <div key={catKey}>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                {CATEGORIES.find(c => c.key === catKey)?.label}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(joke => (
                  <JokeCard
                    key={joke.id}
                    joke={joke}
                    isOwner={joke.user_id === currentUser}
                    onDelete={handleDelete}
                    onReRecord={handleReRecord}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => { setEditingJoke(null); setShowModal(true) }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl transition-colors"
      >
        +
      </button>

      {showModal && (
        <RecordModal
          currentUserId={currentUser!}
          editingJoke={editingJoke}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingJoke(null) }}
        />
      )}
    </div>
  )
}