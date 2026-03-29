'use client'

import { useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const MOODS = [
  { key: 'funny', label: '😄 Funny' },
  { key: 'nostalgic', label: '🌅 Nostalgic' },
  { key: 'heartwarming', label: '🥰 Heartwarming' },
  { key: 'bittersweet', label: '🍂 Bittersweet' },
]

const ERAS = [
  { key: 'childhood', label: '🧸 Childhood' },
  { key: 'teen_years', label: '🎒 Teen Years' },
  { key: 'adult', label: '🏠 Adult' },
  { key: 'recent', label: '📅 Recent' },
]

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

type Props = {
  currentUser: { id: string; email: string }
  editingStory: Story | null
  profiles: Profile[]
  getAvatarUrl: (fullName: string) => string
  onSave: () => void
  onClose: () => void
}

export default function StoryModal({ currentUser, editingStory, profiles, getAvatarUrl, onSave, onClose }: Props) {
  const [title, setTitle] = useState(editingStory?.title ?? '')
  const [mood, setMood] = useState(editingStory?.mood ?? 'funny')
  const [era, setEra] = useState(editingStory?.era ?? 'recent')
  const [selectedPeople, setSelectedPeople] = useState<string[]>(
    editingStory?.story_people.map(sp => sp.profile_email) ?? []
  )
  const [mode, setMode] = useState<'choose' | 'record' | 'upload'>('choose')
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  function togglePerson(email: string) {
    setSelectedPeople(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    )
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = e => chunksRef.current.push(e.data)
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach(t => t.stop())
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
    } catch {
      setError('Microphone access denied.')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAudioBlob(file)
    setAudioUrl(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!title.trim()) return setError('Please add a title.')
    if (!audioBlob && !editingStory) return setError('Please record or upload audio.')
    setSaving(true)
    setError(null)

    try {
      let finalAudioUrl = editingStory?.audio_url ?? ''

      if (audioBlob) {
        const ext = audioBlob.type.includes('webm') ? 'webm' : 'mp3'
        const path = `${currentUser.id}/${Date.now()}.${ext}`

        if (editingStory) {
          const oldPath = editingStory.audio_url.split('/story-audio/')[1]
          if (oldPath) await supabase.storage.from('story-audio').remove([oldPath])
        }

        const { error: uploadError } = await supabase.storage
          .from('story-audio')
          .upload(path, audioBlob, { contentType: audioBlob.type })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('story-audio')
          .getPublicUrl(path)

        finalAudioUrl = publicUrl
      }

      let storyId = editingStory?.id

      if (editingStory) {
        const { error: updateError } = await supabase
          .from('stories')
          .update({ title, mood, era, audio_url: finalAudioUrl })
          .eq('id', editingStory.id)
        if (updateError) throw updateError
      } else {
        const { data, error: insertError } = await supabase
          .from('stories')
          .insert({ user_id: currentUser.id, title, mood, era, audio_url: finalAudioUrl })
          .select('id')
          .single()
        if (insertError) throw insertError
        storyId = data.id
      }

      // Sync story_people
      await supabase.from('story_people').delete().eq('story_id', storyId)
      if (selectedPeople.length > 0) {
        await supabase.from('story_people').insert(
          selectedPeople.map(email => ({ story_id: storyId, profile_email: email }))
        )
      }

      onSave()
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {editingStory ? 'Edit Story' : 'Share a Story'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {/* Title */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. The time Dad got lost in IKEA"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* Mood */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-2">Mood</label>
          <div className="flex gap-2 flex-wrap">
            {MOODS.map(m => (
              <button
                key={m.key}
                onClick={() => setMood(m.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
                  ${mood === m.key
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
          <label className="text-xs font-medium text-gray-600 block mb-2">Era</label>
          <div className="flex gap-2 flex-wrap">
            {ERAS.map(e => (
              <button
                key={e.key}
                onClick={() => setEra(e.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
                  ${era === e.key
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
          <label className="text-xs font-medium text-gray-600 block mb-2">Who's in this story?</label>
          <div className="flex gap-2 flex-wrap">
            {profiles.map(p => (
              <button
                key={p.email}
                onClick={() => togglePerson(p.email)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
                  ${selectedPeople.includes(p.email)
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                <img
                  src={getAvatarUrl(p.full_name)}
                  alt={p.first_name}
                  className="w-4 h-4 rounded-full object-cover"
                />
                {p.first_name}
              </button>
            ))}
          </div>
        </div>

        {/* Audio */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-2">
            {editingStory ? 'Re-record (optional)' : 'Record your story'}
          </label>

          {mode === 'choose' && (
            <div className="flex gap-3">
              <button
                onClick={() => setMode('record')}
                className="flex-1 border-2 border-dashed border-gray-200 rounded-xl py-4 text-center hover:border-indigo-300 transition-colors"
              >
                <div className="text-2xl mb-1">🎙️</div>
                <div className="text-xs font-medium text-gray-600">Record</div>
              </button>
              <button
                onClick={() => setMode('upload')}
                className="flex-1 border-2 border-dashed border-gray-200 rounded-xl py-4 text-center hover:border-indigo-300 transition-colors"
              >
                <div className="text-2xl mb-1">📁</div>
                <div className="text-xs font-medium text-gray-600">Upload file</div>
              </button>
            </div>
          )}

          {mode === 'record' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                {!recording ? (
                  <button
                    onClick={startRecording}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2 text-sm font-medium transition-colors"
                  >
                    ● Start Recording
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="flex-1 bg-gray-800 text-white rounded-lg py-2 text-sm font-medium animate-pulse"
                  >
                    ■ Stop
                  </button>
                )}
                <button
                  onClick={() => { setMode('choose'); setAudioBlob(null); setAudioUrl(null) }}
                  className="px-3 py-2 text-xs text-gray-400 hover:text-gray-600"
                >
                  Back
                </button>
              </div>
              {audioUrl && <audio src={audioUrl} controls className="w-full h-8" />}
            </div>
          )}

          {mode === 'upload' && (
            <div className="space-y-3">
              <div className="flex gap-2 items-center">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  aria-label="Upload audio file"
                  className="text-sm text-gray-600 flex-1"
                />
                <button
                  onClick={() => { setMode('choose'); setAudioBlob(null); setAudioUrl(null) }}
                  className="px-3 py-2 text-xs text-gray-400 hover:text-gray-600"
                >
                  Back
                </button>
              </div>
              {audioUrl && <audio src={audioUrl} controls className="w-full h-8" />}
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
        >
          {saving ? 'Saving...' : editingStory ? 'Save Changes' : 'Share Story'}
        </button>
      </div>
    </div>
  )
}