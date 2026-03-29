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
  { key: 'all', label: 'All Moods' },
  { key: 'funny', label: '😄 Funny' },
  { key: 'nostalgic', label: '🌅 Nostalgic' },
  { key: 'heartwarming', label: '🥰 Heartwarming' },
  { key: 'bittersweet', label: '🍂 Bittersweet' },
]

const ERAS = [
  { key: 'all', label: 'All Eras' },
  { key: 'childhood', label: '🧸 Childhood' },
  { key: 'teen_years', label: '🎒 Teen Years' },
  { key: 'adult', label: '🏠 Adult' },
  { key: 'recent', label: '📅 Recent' },
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
  const [activeMood, setActiveMood] = useState('all')
  const [activeEra, setActiveEra] = useState('all')
  const [activePeople, setActivePeople] = useState<string[]>([])
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

  // Find a profile by matching their email to the story's user auth email
  function getPosterProfile(story: Story): Profile | undefined {
    return profiles.find(p => p.email === currentUser?.email)
  }

  function getFiltered() {
    return stories.filter(s => {
      const moodMatch = activeMood === 'all' || s.mood === activeMood
      const eraMatch = activeEra === 'all' || s.era === activeEra
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
        <div className="bg-white border-b px-6 py-5">
          <h1 className="text-2xl font-bold text-gray-900">📖 Stories</h1>
          <p className="text-sm text-gray-500 mt-0.5">Family memories, one recording at a time</p>
        </div>

        {/* Mood filter */}
        <div className="bg-white border-b px-6 overflow-x-auto">
          <div className="flex gap-1 py-2 min-w-max">
            {MOODS.map(m => (
              <button
                key={m.key}
                onClick={() => setActiveMood(m.key)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap
                  ${activeMood === m.key
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Era filter */}
        <div className="bg-white border-b px-6 overflow-x-auto">
          <div className="flex gap-1 py-2 min-w-max">
            {ERAS.map(e => (
              <button
                key={e.key}
                onClick={() => setActiveEra(e.key)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap
                  ${activeEra === e.key
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>

        {/* People filter */}
        <div className="bg-white border-b px-6 py-3 flex gap-2 overflow-x-auto">
          {profiles.map(p => (
            <button
              key={p.email}
              onClick={() => togglePerson(p.email)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors
                ${activePeople.includes(p.email)
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
            >
              <img
                src={getAvatarUrl(p.full_name)}
                alt={p.first_name}
                className="w-4 h-4 rounded-full object-cover"
              />
              {p.first_name}
            </button>
          ))}
          {activePeople.length > 0 && (
            <button
              onClick={() => setActivePeople([])}
              className="px-3 py-1 rounded-full text-xs text-gray-400 border border-gray-200 hover:bg-gray-50"
            >
              Clear
            </button>
          )}
        </div>

        {/* Stories feed */}
        <div className="px-6 py-6 space-y-4 max-w-2xl mx-auto">
          {loading ? (
            <p className="text-gray-400 text-sm">Loading stories...</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-400 text-sm">No stories match your filters — try broadening them.</p>
          ) : (
            filtered.map(story => (
              <StoryCard
                key={story.id}
                story={story}
                profiles={profiles}
                getAvatarUrl={getAvatarUrl}
                isOwner={story.user_id === currentUser?.id}
                onDelete={handleDelete}
                onReRecord={handleReRecord}
              />
            ))
          )}
        </div>

        {/* FAB */}
        <button
          onClick={() => { setEditingStory(null); setShowModal(true) }}
          className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl transition-colors"
        >
          +
        </button>

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