'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import AuthGuard from '@/app/components/AuthGuard'
import StoryCard from '../components/stories/StoryCard'
import StoryModal from '../components/stories/StoryModal'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const MOODS = [
  { key: 'funny',        label: '😄 Funny' },
  { key: 'nostalgic',   label: '🌅 Nostalgic' },
  { key: 'heartwarming', label: '🥰 Heartwarming' },
  { key: 'bittersweet', label: '🍂 Bittersweet' },
]

const ERAS = [
  { key: 'childhood', label: '🧸 Childhood' },
  { key: 'teen_years', label: '🎒 Teen Years' },
  { key: 'adult',     label: '🏠 Adult' },
  { key: 'recent',    label: '📅 Recent' },
]

function getAvatarUrl(fullName: string) {
  const fileName = fullName.toLowerCase().replaceAll(' ', '-') + '.jpg'
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${fileName}`
}

type Profile = {
  email: string
  full_name: string
  first_name: string
}

type Story = {
  id: string
  user_id: string
  title: string
  mood: string
  era: string
  audio_url: string
  created_at: string
  story_people: { profile_email: string }[]
  poster_email?: string
}

export default function StoriesPage() {
  const [stories, setStories] = useState<Story[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null)
  const [activeMood, setActiveMood] = useState<string | null>(null)
  const [activeEra, setActiveEra] = useState<string | null>(null)
  const [activePeople, setActivePeople] = useState<string[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingStory, setEditingStory] = useState<Story | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) setCurrentUser({ id: user.id, email: user.email ?? '' })

    const { data: storiesData } = await supabase
      .from('stories')
      .select('*, story_people(profile_email)')
      .order('created_at', { ascending: false })

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('email, full_name, first_name')

    setStories(storiesData ?? [])
    setProfiles(profilesData ?? [])
    setLoading(false)
  }

  function getFiltered() {
    return stories.filter(s => {
      const moodMatch = !activeMood || s.mood === activeMood
      const eraMatch = !activeEra || s.era === activeEra
      const peopleMatch =
        activePeople.length === 0 ||
        activePeople.every(email =>
          s.story_people.some(sp => sp.profile_email === email)
        )
      return moodMatch && eraMatch && peopleMatch
    })
  }

  function togglePerson(email: string) {
    setActivePeople(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    )
  }

  function clearFilters() {
    setActiveMood(null)
    setActiveEra(null)
    setActivePeople([])
  }

  const hasActiveFilters = activeMood || activeEra || activePeople.length > 0

  async function handleDelete(id: string, audioUrl: string) {
    const path = audioUrl.split('/story-audio/')[1]
    if (path) await supabase.storage.from('story-audio').remove([path])
    await supabase.from('stories').delete().eq('id', id)
    setStories(prev => prev.filter(s => s.id !== id))
  }

  function handleReRecord(story: Story) {
    setEditingStory(story)
    setShowModal(true)
  }

  async function handleSave() {
    setShowModal(false)
    setEditingStory(null)
    fetchAll()
  }

  const filtered = getFiltered()

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 pb-24">

        {/* Header */}
        <div className="bg-white border-b px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📖 Memory Lane</h1>
            <p className="text-sm text-gray-500 mt-0.5">Family stories, preserved forever</p>
          </div>
          <button
            onClick={() => { setEditingStory(null); setShowModal(true) }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
          >
            <span className="text-base">🎙️</span> Record a Story
          </button>
        </div>

        {/* Filter bar */}
        <div className="bg-white border-b px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => setFiltersOpen(prev => !prev)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors
              ${filtersOpen || hasActiveFilters
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <span>🔍</span>
            Filters
            {hasActiveFilters && (
              <span className="ml-1 w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">
                {(activeMood ? 1 : 0) + (activeEra ? 1 : 0) + activePeople.length}
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Clear all
            </button>
          )}

          {/* Active filter chips */}
          <div className="flex gap-2 overflow-x-auto">
            {activeMood && (
              <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium whitespace-nowrap">
                {MOODS.find(m => m.key === activeMood)?.label}
                <button onClick={() => setActiveMood(null)} className="hover:text-indigo-900 ml-0.5">×</button>
              </span>
            )}
            {activeEra && (
              <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium whitespace-nowrap">
                {ERAS.find(e => e.key === activeEra)?.label}
                <button onClick={() => setActiveEra(null)} className="hover:text-amber-900 ml-0.5">×</button>
              </span>
            )}
            {activePeople.map(email => {
              const p = profiles.find(pr => pr.email === email)
              return p ? (
                <span key={email} className="flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium whitespace-nowrap">
                  <img src={getAvatarUrl(p.full_name)} alt={p.first_name} className="w-3.5 h-3.5 rounded-full object-cover" />
                  {p.first_name}
                  <button onClick={() => togglePerson(email)} className="hover:text-gray-900 ml-0.5">×</button>
                </span>
              ) : null
            })}
          </div>
        </div>

        {/* Expanded filter panel */}
        {filtersOpen && (
          <div className="bg-white border-b px-6 py-4 space-y-4">
            {/* Mood */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Mood</p>
              <div className="flex gap-2 flex-wrap">
                {MOODS.map(m => (
                  <button
                    key={m.key}
                    onClick={() => setActiveMood(activeMood === m.key ? null : m.key)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors
                      ${activeMood === m.key
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Era */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Era</p>
              <div className="flex gap-2 flex-wrap">
                {ERAS.map(e => (
                  <button
                    key={e.key}
                    onClick={() => setActiveEra(activeEra === e.key ? null : e.key)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors
                      ${activeEra === e.key
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            </div>

            {/* People */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Who's in it</p>
              <div className="flex gap-2 flex-wrap">
                {profiles.map(p => (
                  <button
                    key={p.email}
                    onClick={() => togglePerson(p.email)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors
                      ${activePeople.includes(p.email)
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    <img src={getAvatarUrl(p.full_name)} alt={p.first_name} className="w-5 h-5 rounded-full object-cover" />
                    {p.first_name}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setFiltersOpen(false)}
              className="text-sm text-indigo-600 font-medium hover:text-indigo-700"
            >
              Done
            </button>
          </div>
        )}

        {/* Stories feed */}
        <div className="px-6 py-6 space-y-4 max-w-2xl mx-auto">
          {loading ? (
            <div className="text-center py-16">
              <p className="text-gray-400 text-sm">Loading stories...</p>
            </div>
          ) : stories.length === 0 ? (
            /* Empty state — no stories at all */
            <div className="text-center py-16 px-4">
              <div className="text-5xl mb-4">🎙️</div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">No stories yet</h2>
              <p className="text-gray-500 text-sm mb-6 max-w-xs mx-auto">
                Be the first to record a family memory. It only takes a minute.
              </p>
              <button
                onClick={() => { setEditingStory(null); setShowModal(true) }}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-sm"
              >
                🎙️ Record the first story
              </button>
            </div>
          ) : filtered.length === 0 ? (
            /* Empty state — filters too narrow */
            <div className="text-center py-16 px-4">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-gray-500 text-sm">No stories match those filters.</p>
              <button
                onClick={clearFilters}
                className="mt-3 text-indigo-600 text-sm font-medium hover:text-indigo-700"
              >
                Clear filters
              </button>
            </div>
          ) : (
            filtered.map(story => (
              <StoryCard
                key={story.id}
                story={story}
                profiles={profiles}
                getAvatarUrl={getAvatarUrl}
                currentUserEmail={currentUser?.email ?? ''}
                isOwner={story.user_id === currentUser?.id}
                onDelete={handleDelete}
                onReRecord={handleReRecord}
              />
            ))
          )}
        </div>

        {showModal && currentUser && (
          <StoryModal
            currentUser={currentUser}
            editingStory={editingStory}
            profiles={profiles}
            getAvatarUrl={getAvatarUrl}
            onSave={handleSave}
            onClose={() => { setShowModal(false); setEditingStory(null) }}
          />
        )}
      </div>
    </AuthGuard>
  )
}
