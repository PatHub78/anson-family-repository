'use client'

// components/jokes/RecordModal.tsx
import { useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const CATEGORIES = [
  { key: 'knock_knock', label: 'Knock Knock' },
  { key: 'one_liner', label: 'One-Liner' },
  { key: 'guy_walks_in', label: 'Guy Walks Into a Bar' },
  { key: 'other', label: 'Other' },
]

type Joke = {
  id: string
  user_id: string
  title: string
  category: string
  audio_url: string
  created_at: string
  profiles: any
}

type Props = {
  currentUserId: string
  editingJoke: Joke | null
  onSave: (joke: Joke) => void
  onClose: () => void
}

export default function RecordModal({ currentUserId, editingJoke, onSave, onClose }: Props) {
  const [title, setTitle] = useState(editingJoke?.title ?? '')
  const [category, setCategory] = useState(editingJoke?.category ?? 'knock_knock')
  const [mode, setMode] = useState<'choose' | 'record' | 'upload'>('choose')
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

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
    if (!audioBlob && !editingJoke) return setError('Please record or upload audio.')
    setSaving(true)
    setError(null)

    try {
      let finalAudioUrl = editingJoke?.audio_url ?? ''

      if (audioBlob) {
        const ext = audioBlob.type.includes('webm') ? 'webm' : 'mp3'
        const path = `${currentUserId}/${Date.now()}.${ext}`

        // If re-recording, delete old file
        if (editingJoke) {
          const oldPath = editingJoke.audio_url.split('/joke-audio/')[1]
          if (oldPath) await supabase.storage.from('joke-audio').remove([oldPath])
        }

        const { error: uploadError } = await supabase.storage
          .from('joke-audio')
          .upload(path, audioBlob, { contentType: audioBlob.type })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('joke-audio')
          .getPublicUrl(path)

        finalAudioUrl = publicUrl
      }

      if (editingJoke) {
        const { data, error: updateError } = await supabase
          .from('jokes')
          .update({ title, category, audio_url: finalAudioUrl })
          .eq('id', editingJoke.id)
          .select('*, profiles(id, full_name, avatar_url)')
          .single()

        if (updateError) throw updateError
        onSave(data)
      } else {
        const { data, error: insertError } = await supabase
          .from('jokes')
          .insert({ user_id: currentUserId, title, category, audio_url: finalAudioUrl })
          .select('*, profiles(id, full_name, avatar_url)')
          .single()

        if (insertError) throw insertError
        onSave(data)
      }
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {editingJoke ? 'Re-record Joke' : 'Add a Joke'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {/* Title */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Why don't scientists trust atoms?"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* Category */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Category</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {CATEGORIES.map(c => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Audio input */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-2">Audio</label>

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
                <button onClick={() => { setMode('choose'); setAudioBlob(null); setAudioUrl(null) }}
                  className="px-3 py-2 text-xs text-gray-400 hover:text-gray-600">
                  Back
                </button>
              </div>
              {audioUrl && (
                <audio src={audioUrl} controls className="w-full h-8" />
              )}
            </div>
          )}

          {mode === 'upload' && (
            <div className="space-y-3">
              <div className="flex gap-2 items-center">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="text-sm text-gray-600 flex-1"
                />
                <button onClick={() => { setMode('choose'); setAudioBlob(null); setAudioUrl(null) }}
                  className="px-3 py-2 text-xs text-gray-400 hover:text-gray-600">
                  Back
                </button>
              </div>
              {audioUrl && (
                <audio src={audioUrl} controls className="w-full h-8" />
              )}
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
        >
          {saving ? 'Saving...' : editingJoke ? 'Save Re-recording' : 'Post Joke'}
        </button>
      </div>
    </div>
  )
}