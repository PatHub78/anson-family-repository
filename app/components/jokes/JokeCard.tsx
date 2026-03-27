'use client'

// components/jokes/JokeCard.tsx
import { useRef, useState } from 'react'

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

type Props = {
  joke: Joke
  isOwner: boolean
  onDelete: (id: string, audioUrl: string) => void
  onReRecord: (joke: Joke) => void
}

export default function JokeCard({ joke, isOwner, onDelete, onReRecord }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
    } else {
      audio.play()
    }
    setPlaying(!playing)
  }

  function handleTimeUpdate() {
    const audio = audioRef.current
    if (!audio) return
    setProgress(audio.currentTime)
  }

  function handleLoadedMetadata() {
    setDuration(audioRef.current?.duration ?? 0)
  }

  function handleEnded() {
    setPlaying(false)
    setProgress(0)
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Number(e.target.value)
    setProgress(Number(e.target.value))
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const profile = joke.profiles

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-3">
      {/* User info */}
      <div className="flex items-center gap-2">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
            {profile?.full_name?.[0] ?? '?'}
          </div>
        )}
        <div>
          <p className="text-xs font-semibold text-gray-800">{profile?.full_name?.split(' ')[0]}</p>
          <p className="text-xs text-gray-400">{new Date(joke.created_at).toLocaleDateString()}</p>
        </div>

        {isOwner && (
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => onReRecord(joke)}
              title="Re-record"
              className="text-gray-400 hover:text-indigo-500 transition-colors text-sm"
            >
              🔄
            </button>
            {confirmDelete ? (
              <div className="flex gap-1 items-center">
                <button
                  onClick={() => onDelete(joke.id, joke.audio_url)}
                  className="text-xs text-red-500 font-medium hover:underline"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-gray-400 hover:underline"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                title="Delete"
                className="text-gray-400 hover:text-red-400 transition-colors text-sm"
              >
                🗑️
              </button>
            )}
          </div>
        )}
      </div>

      {/* Title */}
      <p className="text-sm font-semibold text-gray-900 leading-snug">{joke.title}</p>

      {/* Audio player */}
      <div className="flex items-center gap-2">
        <button
          onClick={togglePlay}
          className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center text-white transition-colors flex-shrink-0"
        >
          {playing ? '⏸' : '▶'}
        </button>
        <input
          type="range"
          min={0}
          max={duration || 1}
          value={progress}
          onChange={handleSeek}
          className="flex-1 h-1 accent-indigo-600"
        />
        <span className="text-xs text-gray-400 tabular-nums w-10 text-right">
          {playing || progress > 0 ? fmt(progress) : fmt(duration)}
        </span>
      </div>

      <audio
        ref={audioRef}
        src={joke.audio_url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />
    </div>
  )
}