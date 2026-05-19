'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import AuthGuard from '@/app/components/AuthGuard'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

type Profile = {
  email: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  city: string | null
  state: string | null
  country: string | null
  birthday: string | null
  description: string | null
}

function avatarFileName(fullName: string) {
  return `${fullName.toLowerCase().replaceAll(' ', '-')}.jpg`
}

function avatarUrl(fullName: string, cacheBust?: number) {
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${avatarFileName(fullName)}`
  return cacheBust ? `${base}?t=${cacheBust}` : base
}

// Convert any image File → JPEG Blob, optionally resized to fit within maxDim
async function imageToJpeg(file: File, maxDim = 600, quality = 0.88): Promise<Blob> {
  // HEIC support — convert first if needed
  const isHeic = /\.heic$/i.test(file.name) || /\.heif$/i.test(file.name) ||
                  file.type === 'image/heic' || file.type === 'image/heif'

  let workingFile: Blob = file
  if (isHeic) {
    const heic2any = (await import('heic2any')).default
    workingFile = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 }) as Blob
  }

  // Draw to canvas, resize, export as JPEG
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(workingFile)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = dataUrl
  })

  let { width, height } = img
  if (width > maxDim || height > maxDim) {
    const scale = maxDim / Math.max(width, height)
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(img, 0, 0, width, height)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Conversion failed')), 'image/jpeg', quality)
  })
}

export default function ProfilePage() {
  const [profile, setProfile]   = useState<Profile | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saving,  setSaving]    = useState(false)
  const [uploading, setUploading] = useState(false)
  const [avatarBust, setAvatarBust] = useState<number>(0)
  const [notice,  setNotice]    = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Editable form state (separate from saved profile so we can detect dirty/cancel)
  const [city,        setCity]        = useState('')
  const [stateField,  setStateField]  = useState('')
  const [country,     setCountry]     = useState('')
  const [birthday,    setBirthday]    = useState('')
  const [description, setDescription] = useState('')

  function showNotice(msg: string) {
    setNotice(msg)
    setTimeout(() => setNotice(null), 3000)
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) { setLoading(false); return }
      const { data } = await supabase
        .from('profiles')
        .select('email, first_name, last_name, full_name, city, state, country, birthday, description')
        .eq('email', user.email)
        .single()
      if (data) {
        setProfile(data)
        setCity(data.city ?? '')
        setStateField(data.state ?? '')
        setCountry(data.country ?? '')
        setBirthday(data.birthday ?? '')
        setDescription(data.description ?? '')
      }
      setLoading(false)
    })()
  }, [])

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile?.full_name) return

    setUploading(true)
    try {
      const jpeg = await imageToJpeg(file, 600, 0.88)
      const path = avatarFileName(profile.full_name)
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, jpeg, { contentType: 'image/jpeg', upsert: true, cacheControl: '60' })
      if (error) {
        showNotice('Upload failed: ' + error.message)
      } else {
        setAvatarBust(Date.now())
        showNotice('Photo updated! ✓')
      }
    } catch (err) {
      showNotice('Could not process image')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSave() {
    if (!profile || saving) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        city: city.trim() || null,
        state: stateField.trim() || null,
        country: country.trim() || null,
        birthday: birthday || null,
        description: description.trim() || null,
      })
      .eq('email', profile.email)
    setSaving(false)
    if (error) {
      showNotice('Save failed: ' + error.message)
    } else {
      showNotice('Saved ✓')
      setProfile({ ...profile, city, state: stateField, country, birthday, description })
    }
  }

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p className="text-gray-400 text-sm">Loading…</p>
        </div>
      </AuthGuard>
    )
  }

  if (!profile) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
          <p className="text-gray-500 text-sm text-center">No profile found for your account.</p>
        </div>
      </AuthGuard>
    )
  }

  const displayName = profile.full_name ?? profile.email

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 pb-24">

        {/* Header */}
        <div className="bg-white border-b px-6 py-5">
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <p className="text-sm text-gray-500 mt-0.5">Edit your details and photo</p>
        </div>

        {/* Avatar section */}
        <div className="flex flex-col items-center pt-8 pb-6 px-6">
          <div className="relative">
            {profile.full_name ? (
              <img
                src={avatarUrl(profile.full_name, avatarBust)}
                alt={displayName}
                className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
                onError={(e) => { (e.target as HTMLImageElement).src = '/avatar-placeholder.png' }}
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gray-200 border-4 border-white shadow-lg flex items-center justify-center text-3xl text-gray-400">
                👤
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-3 border-white border-t-transparent rounded-full" />
              </div>
            )}
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : '📷 Change Photo'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.heic,.heif"
            onChange={handleAvatarUpload}
            className="hidden"
          />

          <h2 className="mt-4 text-xl font-bold text-gray-900">{displayName}</h2>
          <p className="text-sm text-gray-500">{profile.email}</p>
        </div>

        {/* Editable fields */}
        <div className="max-w-xl mx-auto px-6 space-y-5">

          <Section title="About you">
            <Field label="Description / bio">
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="A short blurb about yourself…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </Field>
            <Field label="Birthday">
              <input
                type="date"
                value={birthday}
                onChange={e => setBirthday(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </Field>
          </Section>

          <Section title="Where you are">
            <Field label="City">
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="e.g. Kraków"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </Field>
            <Field label="State / Region">
              <input
                type="text"
                value={stateField}
                onChange={e => setStateField(e.target.value)}
                placeholder="e.g. Lesser Poland"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </Field>
            <Field label="Country">
              <input
                type="text"
                value={country}
                onChange={e => setCountry(e.target.value)}
                placeholder="e.g. Poland"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </Field>
          </Section>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors shadow-sm"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>

          <p className="text-center text-xs text-gray-400 pt-2">
            Want to change your name or email? Contact Patrick.
          </p>
        </div>

        {/* Toast */}
        {notice && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-xl z-50">
            {notice}
          </div>
        )}
      </div>
    </AuthGuard>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-sm">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  )
}
