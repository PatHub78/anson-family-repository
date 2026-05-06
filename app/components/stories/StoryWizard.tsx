'use client'

import { useRef, useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Profile = { email: string; full_name: string; first_name: string }

type Props = {
  currentUser: { id: string; email: string }
  profiles: Profile[]
  getAvatarUrl: (name: string) => string
  onSave: () => void
  onClose: () => void
}

type Step =
  | 'welcome'
  | 'name-ask'
  | 'name-input'
  | 'people'
  | 'mic-check'
  | 'ready'
  | 'recording'
  | 'review'
  | 'saving'
  | 'done'

/* ── Mic level visualiser ───────────────────────────────── */
function MicBars({ stream }: { stream: MediaStream | null }) {
  const [levels, setLevels] = useState([0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1])
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!stream) return
    const ctx      = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 64
    ctx.createMediaStreamSource(stream).connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)

    function tick() {
      analyser.getByteFrequencyData(data)
      const bars = Array.from({ length: 7 }, (_, i) => {
        const val = data[Math.floor(i * data.length / 7)] / 255
        return Math.max(0.07, val)
      })
      setLevels(bars)
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      cancelAnimationFrame(rafRef.current)
      ctx.close()
    }
  }, [stream])

  return (
    <div className="flex items-center justify-center gap-1.5 h-16 my-4">
      {levels.map((v, i) => (
        <div
          key={i}
          className="w-4 rounded-full bg-green-500 transition-all duration-75"
          style={{ height: `${v * 100}%`, opacity: 0.7 + v * 0.3 }}
        />
      ))}
    </div>
  )
}

/* ── Main Wizard ─────────────────────────────────────────── */
export default function StoryWizard({ currentUser, profiles, getAvatarUrl, onSave, onClose }: Props) {
  const [step, setStep]                   = useState<Step>('welcome')
  const [title, setTitle]                 = useState('')
  const [selectedPeople, setSelectedPeople] = useState<string[]>([])
  const [micStream, setMicStream]         = useState<MediaStream | null>(null)
  const [micOk, setMicOk]                = useState(false)
  const [micError, setMicError]           = useState('')
  const [recording, setRecording]         = useState(false)
  const [audioBlob, setAudioBlob]         = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl]           = useState<string | null>(null)
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const titleInputRef    = useRef<HTMLInputElement>(null)

  // Auto-focus the title input
  useEffect(() => {
    if (step === 'name-input') setTimeout(() => titleInputRef.current?.focus(), 100)
  }, [step])

  // Clean up mic stream when leaving mic-check
  useEffect(() => {
    if (step !== 'mic-check' && step !== 'ready' && step !== 'recording') {
      micStream?.getTracks().forEach(t => t.stop())
      if (step !== 'review' && step !== 'saving' && step !== 'done') setMicStream(null)
    }
  }, [step])

  function togglePerson(email: string) {
    setSelectedPeople(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    )
  }

  async function startMicCheck() {
    setMicError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setMicStream(stream)
      setMicOk(true)
    } catch {
      setMicError("We couldn't access your microphone. Please check that your browser has permission to use it, then try again.")
    }
  }

  async function startRecording() {
    setError('')
    try {
      // Reuse existing stream or get a new one
      const stream = micStream ?? await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!micStream) setMicStream(stream)

      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = e => chunksRef.current.push(e.data)
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
      setStep('recording')
    } catch {
      setError("Couldn't start recording. Please go back and test your microphone again.")
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
    setStep('review')
  }

  function retryRecording() {
    setAudioBlob(null)
    setAudioUrl(null)
    setStep('ready')
  }

  async function saveStory() {
    if (!audioBlob) return
    setSaving(true)
    setStep('saving')
    setError('')

    try {
      const ext  = audioBlob.type.includes('webm') ? 'webm' : 'mp3'
      const path = `${currentUser.id}/${Date.now()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('story-audio')
        .upload(path, audioBlob, { contentType: audioBlob.type })
      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage.from('story-audio').getPublicUrl(path)

      const { data, error: insErr } = await supabase
        .from('stories')
        .insert({
          user_id:   currentUser.id,
          title:     title.trim() || 'Untitled Story',
          mood:      'nostalgic',
          era:       'recent',
          audio_url: publicUrl,
        })
        .select('id')
        .single()
      if (insErr) throw insErr

      if (selectedPeople.length > 0) {
        await supabase.from('story_people').insert(
          selectedPeople.map(email => ({ story_id: data.id, profile_email: email }))
        )
      }

      micStream?.getTracks().forEach(t => t.stop())
      setStep('done')
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Please try again.')
      setStep('review')
    } finally {
      setSaving(false)
    }
  }

  /* ── Shared layout ──────────────────────────────────────── */
  function Screen({ children }: { children: React.ReactNode }) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-3xl w-full max-w-lg p-8 flex flex-col items-center text-center gap-6 relative max-h-[90vh] overflow-y-auto">
          {step !== 'welcome' && step !== 'recording' && step !== 'saving' && step !== 'done' && (
            <button
              onClick={onClose}
              className="absolute top-4 right-5 text-gray-300 hover:text-gray-500 text-2xl leading-none"
            >
              ✕
            </button>
          )}
          {children}
        </div>
      </div>
    )
  }

  function BigButton({ onClick, children, color = 'indigo', disabled = false }: {
    onClick: () => void; children: React.ReactNode; color?: 'indigo' | 'green' | 'red' | 'gray'; disabled?: boolean
  }) {
    const colours = {
      indigo: 'bg-indigo-600 hover:bg-indigo-700 text-white',
      green:  'bg-green-600 hover:bg-green-700 text-white',
      red:    'bg-red-600 hover:bg-red-700 text-white',
      gray:   'bg-gray-100 hover:bg-gray-200 text-gray-700',
    }
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`w-full py-5 px-6 rounded-2xl text-xl font-bold transition-colors disabled:opacity-40 shadow-sm ${colours[color]}`}
      >
        {children}
      </button>
    )
  }

  /* ══════════════════════════════════════════════════════════
     STEPS
  ══════════════════════════════════════════════════════════ */

  if (step === 'welcome') return (
    <Screen>
      <div className="text-7xl">🎙️</div>
      <h1 className="text-3xl font-black text-gray-900 leading-tight">
        Would you like to record a story?
      </h1>
      <p className="text-gray-500 text-lg">Share a family memory in your own voice.</p>
      <BigButton onClick={() => setStep('name-ask')} color="green">
        ✅ Yes, let's go!
      </BigButton>
      <button onClick={onClose} className="text-gray-400 text-base hover:text-gray-600 mt-2">
        Maybe later
      </button>
    </Screen>
  )

  if (step === 'name-ask') return (
    <Screen>
      <div className="text-6xl">📝</div>
      <h1 className="text-3xl font-black text-gray-900 leading-tight">
        Would you like to give your story a name?
      </h1>
      <div className="flex flex-col gap-3 w-full">
        <BigButton onClick={() => setStep('name-input')} color="indigo">
          ✅ Yes, give it a name
        </BigButton>
        <BigButton onClick={() => setStep('people')} color="gray">
          ➡️ Skip — no name needed
        </BigButton>
      </div>
    </Screen>
  )

  if (step === 'name-input') return (
    <Screen>
      <div className="text-6xl">✏️</div>
      <h1 className="text-3xl font-black text-gray-900 leading-tight">
        What would you like to call your story?
      </h1>
      <input
        ref={titleInputRef}
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && title.trim() && setStep('people')}
        placeholder="e.g. The summer at the beach"
        className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 text-xl focus:outline-none focus:border-indigo-400 text-center"
      />
      <BigButton onClick={() => setStep('people')} color="green" disabled={!title.trim()}>
        ✅ That's the name!
      </BigButton>
      <button onClick={() => setStep('name-ask')} className="text-gray-400 hover:text-gray-600 text-base">
        ← Go back
      </button>
    </Screen>
  )

  if (step === 'people') return (
    <Screen>
      <div className="text-6xl">👨‍👩‍👧‍👦</div>
      <h1 className="text-3xl font-black text-gray-900 leading-tight">
        Who's in this story?
      </h1>
      <p className="text-gray-500 text-base">Tap on someone to include them. You can pick more than one.</p>
      <div className="flex flex-wrap justify-center gap-3 w-full">
        {profiles.map(p => {
          const selected = selectedPeople.includes(p.email)
          return (
            <button
              key={p.email}
              onClick={() => togglePerson(p.email)}
              className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-3 transition-all ${
                selected
                  ? 'border-indigo-500 bg-indigo-50 scale-105'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              style={{ borderWidth: selected ? 3 : 2 }}
            >
              <div className="relative">
                <img
                  src={getAvatarUrl(p.full_name)}
                  alt={p.first_name}
                  className="w-16 h-16 rounded-full object-cover"
                />
                {selected && (
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    ✓
                  </div>
                )}
              </div>
              <span className="text-sm font-semibold text-gray-800">{p.first_name}</span>
            </button>
          )
        })}
      </div>
      <BigButton onClick={() => setStep('mic-check')} color="green">
        ✅ Done — next step
      </BigButton>
      <button onClick={() => setStep('name-ask')} className="text-gray-400 hover:text-gray-600 text-base">
        ← Go back
      </button>
    </Screen>
  )

  if (step === 'mic-check') return (
    <Screen>
      <div className="text-6xl">🎤</div>
      <h1 className="text-3xl font-black text-gray-900 leading-tight">
        Let's check your microphone
      </h1>
      {!micOk ? (
        <>
          <p className="text-gray-500 text-lg">
            Tap the button below, then say something out loud. We'll make sure everything is working before you record.
          </p>
          {micError && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-base">
              {micError}
            </div>
          )}
          <BigButton onClick={startMicCheck} color="indigo">
            🎤 Test my microphone
          </BigButton>
        </>
      ) : (
        <>
          <p className="text-gray-600 text-lg font-medium">
            Say something — watch the bars move!
          </p>
          <MicBars stream={micStream} />
          <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-4 text-green-700 text-lg font-semibold w-full">
            ✅ Your microphone is working!
          </div>
          <BigButton onClick={() => setStep('ready')} color="green">
            ✅ Great — I'm ready!
          </BigButton>
        </>
      )}
      <button onClick={() => setStep('people')} className="text-gray-400 hover:text-gray-600 text-base">
        ← Go back
      </button>
    </Screen>
  )

  if (step === 'ready') return (
    <Screen>
      <div className="text-7xl">🟢</div>
      <h1 className="text-3xl font-black text-gray-900 leading-tight">
        Are you ready to record your story?
      </h1>
      <p className="text-gray-500 text-lg">
        When you tap the button, you'll start recording straight away. Speak clearly and take your time — there's no rush.
      </p>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-base w-full">
          {error}
        </div>
      )}
      <BigButton onClick={startRecording} color="green">
        ✅ YES — START RECORDING
      </BigButton>
      <button onClick={() => setStep('mic-check')} className="text-gray-400 hover:text-gray-600 text-base">
        ← Go back
      </button>
    </Screen>
  )

  if (step === 'recording') return (
    <Screen>
      {/* Pulsing red dot */}
      <div className="relative flex items-center justify-center w-24 h-24">
        <div className="absolute w-24 h-24 rounded-full bg-red-500 opacity-20 animate-ping" />
        <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-white" />
        </div>
      </div>

      <h1 className="text-3xl font-black text-red-600 tracking-wide">
        YOU ARE NOW RECORDING
      </h1>
      <p className="text-gray-600 text-lg">
        Speak clearly and take your time. When you've finished your story, tap the button below.
      </p>

      <BigButton onClick={stopRecording} color="red">
        ⏹ CLICK HERE TO STOP RECORDING
      </BigButton>
    </Screen>
  )

  if (step === 'review') return (
    <Screen>
      <div className="text-6xl">🎧</div>
      <h1 className="text-3xl font-black text-gray-900 leading-tight">
        Here is your recording
      </h1>
      <p className="text-gray-500 text-lg">Tap play to listen back. Does it sound good?</p>

      {audioUrl && (
        <audio src={audioUrl} controls className="w-full rounded-xl" />
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-base w-full">
          {error}
        </div>
      )}

      <BigButton onClick={saveStory} color="green">
        ✅ Yes — Save my story!
      </BigButton>
      <BigButton onClick={retryRecording} color="gray">
        🔄 Record it again
      </BigButton>
    </Screen>
  )

  if (step === 'saving') return (
    <Screen>
      <div className="text-6xl animate-spin">⏳</div>
      <h1 className="text-3xl font-black text-gray-900">Saving your story…</h1>
      <p className="text-gray-500 text-lg">Just a moment, please don't close this.</p>
    </Screen>
  )

  if (step === 'done') return (
    <Screen>
      <div className="text-7xl">🎉</div>
      <h1 className="text-3xl font-black text-gray-900 leading-tight">
        Your story has been saved!
      </h1>
      <p className="text-gray-500 text-lg">
        {title.trim()
          ? `"${title.trim()}" has been added to Memory Lane.`
          : 'Your story has been added to Memory Lane.'}
      </p>
      <p className="text-gray-400 text-base">The whole family will be able to listen to it. 💛</p>
      <BigButton onClick={() => { onSave() }} color="indigo">
        ✅ Done — back to stories
      </BigButton>
    </Screen>
  )

  return null
}
