'use client'

import { useRef, useState } from 'react'

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

const MOOD_LABELS: Record<string, string> = {
  funny: '😄 Funny',
  nostalgic: '🌅 Nostalgic',
  heartwarming: '🥰 Heartwarming',
  bittersweet: '🍂 Bittersweet',
}

const ERA_LABELS: Record<string, string> = {
  childhood: '🧸 Childhood',
  teen_years: '🎒 Teen Years',
  adult: '🏠 Adult',
  recent: '📅 Recent',
}

type Props = {
  story: Story
  profiles: Profile[]
  getAvatarUrl: (fullName: string) => string
  isOwner: boolean
  onDelete: (id: string, audioUrl: string) => void
  onReRecord: (story: Story) => void
}

export default function StoryCard({ story, profiles, getAvatarUrl, isOwner, onDelete, onReRecord }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) { audio.pause() } else { audio.play() }
    setPlaying(!playing)
  }

  function handleTimeUpdate() {
    setProgress(audioRef.current?.currentTime ?? 0)
  }

  function handleLoadedMetadata() {
    setDuration(audioRef.current?.duration ?? 0)
  }

  function handleEnded() {
    setPlaying(false)
    setProgress(0)
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const val = Number(e.target.value)
    if (audioRef.current) audioRef.current.currentTime = val
    setProgress(val)
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const peopleInStory = profiles.filter(p =>
    story.story_people.some(sp => sp.profile_email === p.email)
  )

  // Find poster profile by matching story_people or fall back to first person
  const posterProfile = profiles.find(p => p.email === story.poster_email)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
      {/* Top row: poster + owner actions */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {posterProfile && (
            <img
              src={getAvatarUrl(posterProfile.full_name)}
              alt={posterProfile.first_name}
              className="w-9 h-9 rounded-full object-cover"
            />
          )}
          <div>
            <p className="text-sm font-semibold text-gray-800">
              {posterProfile?.first_name ?? 'Someone'}
            </p>
            <p className="text-xs text-gray-400">
              {new Date(story.created_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric'
              })}
            </p>
          </div>
        </div>

        {isOwner && (
          <div className="flex gap-2 items-center">
            <button
              onClick={() => onReRecord(story)}
              className="text-gray-400 hover:text-indigo-500 transition-colors"
              title="Re-record"
            >
              🔄
            </button>
            {confirmDelete ? (
              <div className="flex gap-1 items-center">
                <button
                  onClick={() => onDelete(story.id, story.audio_url)}
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
                className="text-gray-400 hover:text-red-400 transition-colors"
                title="Delete"
              >
                🗑️
              </button>
            )}
          </div>
        )}
      </div>

      {/* Title */}
      <p className="text-base font-semibold text-gray-900 leading-snug">{story.title}</p>

      {/* Badges */}
      <div className="flex gap-2 flex-wrap">
        <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-medium">
          {MOOD_LABELS[story.mood]}
        </span>
        <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-medium">
          {ERA_LABELS[story.era]}
        </span>
      </div>

      {/* People in story */}
      {peopleInStory.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400">Featuring:</span>
          {peopleInStory.map(p => (
            <div key={p.email} className="flex items-center gap-1">
              <img
                src={getAvatarUrl(p.full_name)}
                alt={p.first_name}
                className="w-5 h-5 rounded-full object-cover"
              />
              <span className="text-xs font-medium text-gray-600">{p.first_name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Audio player */}
      <div className="flex items-center gap-2">
        <button
          onClick={togglePlay}
          className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center text-white transition-colors shrink-0"
        >
          {playing ? '⏸' : '▶'}
        </button>
        <input
          type="range"
          min={0}
          max={duration || 1}
          value={progress}
          onChange={handleSeek}
          aria-label="Seek audio"
          className="flex-1 h-1 accent-indigo-600"
        />
        <span className="text-xs text-gray-400 tabular-nums w-10 text-right">
          {playing || progress > 0 ? fmt(progress) : fmt(duration)}
        </span>
      </div>

      <audio
        ref={audioRef}
        src={story.audio_url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />
    </div>
  )
}