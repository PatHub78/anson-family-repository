'use client'

import { useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

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

const STEPS = ['Name it', 'Tag it', 'Record it']

export default function StoryModal({ currentUser, editingStory, profiles, getAvatarUrl, onSave, onClose }: Props) {
  const [step, setStep] = useState(0)
  const [title, setTitle] = useState(editingStory?.title ?? '')
  const [selectedPeople, setSelectedPeople] = useState<string[]>(
    editingStory?.story_people.map(sp => sp.profile_email) ?? []
  )
  const [mood, setMood] = useState(editingStory?.mood ?? '')
  const [era, setEra] = useState(editingStory?.era ?? '')
  const [audioMode, setAudioMode] = useState<'choose' | 'record' | 'upload'>('choose')
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

  function goNext() {
    setError(null)
    if (step === 0 && !title.trim()) {
      setError('Give the story a title before continuing.')
      return
    }
    if (step === 1 && (!mood || !era)) {
      setError('Pick a mood and an era to continue.')
      return
    }
    setStep(s => s + 1)
  }

  function goBack() {
    setError(null)
    if (audioMode !== 'choose') {
      setAudioMode('choose')
      setAudioBlob(null)
      setAudioUrl(null)
    } else {
      setStep(s => s - 1)
    }
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
      setError('Microphone access was denied. Try uploading a file instead.')
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
    if (!audioBlob && !editingStory) {
      setError('Please record or upload your story audio.')
      return
    }
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

      await supabase.from('story_people').delete().eq('story_id', storyId)
      if (selectedPeople.length > 0) {
        await supabase.from('story_people').insert(
          selectedPeople.map(email => ({ story_id: storyId, profile_email: email }))
        )
      }

      onSave()
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">

        {/* Step indicator */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">
              {editingStory ? 'Edit Story' : 'Share a Story'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
          </div>

          {/* Step pills */}
          <div className="flex gap-1">
            {STEPS.map((label, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className={`h-1.5 w-full rounded-full transition-colors ${
                  i < step ? 'bg-indigo-600' : i === step ? 'bg-indigo-400' : 'bg-gray-200'
                }`} />
                <span className={`text-[10px] font-medium ${
                  i === step ? 'text-indigo-600' : i < step ? 'text-gray-400' : 'text-gray-300'
                }`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-5">

          {/* ── Step 0: Name it ── */}
          {step === 0 && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  What's the story called?
                </label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. The time Dad got lost in IKEA"
                  autoFocus
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Who's in this story? <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {profiles.map(p => (
                    <button
                      key={p.email}
                      onClick={() => togglePerson(p.email)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors
                        ${selectedPeople.includes(p.email)
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      <img
                        src={getAvatarUrl(p.full_name)}
                        alt={p.first_name}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                      {p.first_name}
                      {selectedPeople.includes(p.email) && <span className="text-indigo-500">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Step 1: Tag it ── */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  What's the vibe?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {MOODS.map(m => (
                    <button
                      key={m.key}
                      onClick={() => setMood(m.key)}
                      className={`py-3 rounded-xl text-sm font-medium border-2 transition-colors
                        ${mood === m.key
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-700'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  When did this happen?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ERAS.map(e => (
                    <button
                      key={e.key}
                      onClick={() => setEra(e.key)}
                      className={`py-3 rounded-xl text-sm font-medium border-2 transition-colors
                        ${era === e.key
                          ? 'bg-amber-50 border-amber-400 text-amber-700'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Step 2: Record it ── */}
          {step === 2 && (
            <div className="space-y-4">
              {editingStory && !audioBlob && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
                  You have an existing recording. Record or upload a new one to replace it, or skip to save without changing it.
                </div>
              )}

              {audioMode === 'choose' && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setAudioMode('record')}
                    className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 rounded-2xl py-6 transition-colors"
                  >
                    <span className="text-3xl">🎙️</span>
                    <span className="text-sm font-semibold text-gray-700">Record now</span>
                    <span className="text-xs text-gray-400">Use your mic</span>
                  </button>
                  <button
                    onClick={() => setAudioMode('upload')}
                    className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 rounded-2xl py-6 transition-colors"
                  >
                    <span className="text-3xl">📁</span>
                    <span className="text-sm font-semibold text-gray-700">Upload a file</span>
                    <span className="text-xs text-gray-400">MP3, M4A, WAV…</span>
                  </button>
                </div>
              )}

              {audioMode === 'record' && (
                <div className="space-y-3">
                  {!audioBlob ? (
                    !recording ? (
                      <button
                        onClick={startRecording}
                        className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white rounded-xl py-4 text-sm font-semibold transition-colors"
                      >
                        <span className="w-3 h-3 rounded-full bg-white inline-block" />
                        Tap to start recording
                      </button>
                    ) : (
                      <button
                        onClick={stopRecording}
                        className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white rounded-xl py-4 text-sm font-semibold animate-pulse"
                      >
                        <span className="w-3 h-3 rounded-sm bg-white inline-block" />
                        Recording… tap to stop
                      </button>
                    )
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                        <span>✓</span> Recording ready
                      </div>
                      <audio src={audioUrl ?? ''} controls className="w-full" />
                      <button
                        onClick={() => { setAudioBlob(null); setAudioUrl(null) }}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Re-record
                      </button>
                    </div>
                  )}
                </div>
              )}

              {audioMode === 'upload' && (
                <div className="space-y-3">
                  {!audioBlob ? (
                    <label className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-200 hover:border-indigo-300 rounded-2xl py-6 cursor-pointer transition-colors">
                      <span className="text-3xl">📂</span>
                      <span className="text-sm font-semibold text-gray-700">Choose audio file</span>
                      <span className="text-xs text-gray-400">MP3, M4A, WAV, WEBM</span>
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                        <span>✓</span> File ready
                      </div>
                      <audio src={audioUrl ?? ''} controls className="w-full" />
                      <button
                        onClick={() => { setAudioBlob(null); setAudioUrl(null) }}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Choose a different file
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-3 pt-1">
            {(step > 0 || audioMode !== 'choose') && (
              <button
                onClick={goBack}
                className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
            )}

            {step < 2 ? (
              <button
                onClick={goNext}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                {saving ? 'Saving…' : editingStory ? 'Save Changes' : '🎉 Share Story'}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
