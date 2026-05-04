'use client'

import { useEffect, useState, useCallback } from 'react'
import { Chess } from 'chess.js'
import { createClient } from '@supabase/supabase-js'
import AuthGuard from '@/app/components/AuthGuard'
import ChessBoard, { LastMove } from '../components/chess/ChessBoard'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000

type Profile = { email: string; full_name: string; first_name: string }

type Game = {
  id: string
  white_email: string
  black_email: string
  fen: string
  status: string
  created_at: string
  last_move_at: string
  expires_at: string
}

type MoveRecord = {
  id: string
  move_san: string
  played_by_email: string
  created_at: string
}

type LeaderboardRow = {
  email: string
  first_name: string
  full_name: string
  wins: number
  losses: number
  draws: number
}

function getAvatarUrl(fullName: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${fullName.toLowerCase().replaceAll(' ', '-')}.jpg`
}

function timeLeft(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const days = Math.floor(ms / (24 * 60 * 60 * 1000))
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
  if (days > 0) return `${days}d ${hours}h left`
  return `${hours}h left`
}

function isExpired(expiresAt: string) {
  return new Date(expiresAt).getTime() < Date.now()
}

function gameResult(game: Game, myEmail: string) {
  if (game.status === 'active') return null
  if (game.status === 'draw') return 'draw'
  const iAmWhite = game.white_email === myEmail
  if (game.status === 'white_won') return iAmWhite ? 'win' : 'loss'
  if (game.status === 'black_won') return iAmWhite ? 'loss' : 'win'
  return null
}

// Pair moves into rows: [[w_san, b_san], ...]
function pairMoves(moves: MoveRecord[]) {
  const pairs: { num: number; w: string; b: string }[] = []
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({ num: Math.floor(i / 2) + 1, w: moves[i]?.move_san ?? '', b: moves[i + 1]?.move_san ?? '' })
  }
  return pairs
}

/* ── Player strip (avatar + name + status bar) ── */
function PlayerStrip({ profile, isActive, isYou, timeStr }: {
  profile: Profile | undefined
  isActive: boolean
  isYou: boolean
  timeStr?: string
}) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${isActive ? 'bg-[#BACA2B]/20' : ''}`}>
      {profile ? (
        <img src={getAvatarUrl(profile.full_name)} alt={profile.first_name}
          className="w-9 h-9 rounded-full object-cover border-2 border-white shadow-sm shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-gray-200 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 leading-none">
          {profile?.first_name ?? '—'}{isYou ? <span className="text-gray-400 font-normal text-xs ml-1">(you)</span> : ''}
        </p>
        {timeStr && <p className="text-xs text-gray-400 mt-0.5">{timeStr}</p>}
      </div>
      {isActive && <span className="w-2.5 h-2.5 rounded-full bg-[#769656] shrink-0 animate-pulse" />}
    </div>
  )
}

export default function ChessPage() {
  const [tab, setTab]               = useState<'games' | 'leaderboard' | 'challenge'>('games')
  const [myEmail, setMyEmail]       = useState('')
  const [profiles, setProfiles]     = useState<Profile[]>([])
  const [games, setGames]           = useState<Game[]>([])
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [moveHistory, setMoveHistory]   = useState<MoveRecord[]>([])
  const [lastMove, setLastMove]         = useState<LastMove | null>(null)
  const [leaderboard, setLeaderboard]   = useState<LeaderboardRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [challengeTarget, setChallengeTarget] = useState('')
  const [challengeColor, setChallengeColor]   = useState<'w' | 'b' | 'random'>('random')
  const [challenging, setChallenging] = useState(false)
  const [moveSaving, setMoveSaving]   = useState(false)
  const [notification, setNotification] = useState<string | null>(null)

  function notify(msg: string) {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3500)
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const email = user?.email ?? ''
    setMyEmail(email)

    const [{ data: gamesData }, { data: profilesData }] = await Promise.all([
      supabase.from('chess_games').select('*')
        .or(`white_email.eq.${email},black_email.eq.${email}`)
        .order('last_move_at', { ascending: false }),
      supabase.from('profiles').select('email, full_name, first_name'),
    ])

    setGames(gamesData ?? [])
    setProfiles(profilesData ?? [])

    const { data: allFinished } = await supabase.from('chess_games').select('*').neq('status', 'active')

    const rows: Record<string, LeaderboardRow> = {}
    ;(profilesData ?? []).forEach(p => {
      rows[p.email] = { email: p.email, first_name: p.first_name, full_name: p.full_name, wins: 0, losses: 0, draws: 0 }
    })
    ;(allFinished ?? []).forEach((g: Game) => {
      const w = rows[g.white_email]; const b = rows[g.black_email]
      if (g.status === 'draw') { if (w) w.draws++; if (b) b.draws++ }
      else if (g.status === 'white_won') { if (w) w.wins++; if (b) b.losses++ }
      else if (g.status === 'black_won') { if (b) b.wins++; if (w) w.losses++ }
    })
    setLeaderboard(Object.values(rows).sort((a, b) => b.wins - a.wins || a.losses - b.losses))
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    if (selectedGame) {
      const updated = games.find(g => g.id === selectedGame.id)
      if (updated) setSelectedGame(updated)
    }
  }, [games])

  async function openGame(game: Game) {
    setSelectedGame(game)
    const { data } = await supabase.from('chess_moves').select('*')
      .eq('game_id', game.id).order('created_at', { ascending: true })
    const moves = data ?? []
    setMoveHistory(moves)
    if (moves.length >= 1) {
      // Last move squares aren't stored — we'll leave lastMove null for now
      setLastMove(null)
    }
  }

  async function startChallenge() {
    if (!challengeTarget) return
    setChallenging(true)
    const assignColor = challengeColor === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : challengeColor
    const white = assignColor === 'w' ? myEmail : challengeTarget
    const black = assignColor === 'b' ? myEmail : challengeTarget
    const { error } = await supabase.from('chess_games').insert({
      white_email: white, black_email: black,
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      status: 'active',
    })
    if (error) notify('Could not start game. Try again.')
    else { notify('Game started! White moves first.'); setTab('games'); fetchAll() }
    setChallenging(false)
  }

  async function handleMove(san: string, fenAfter: string, from: string, to: string) {
    if (!selectedGame || moveSaving) return
    setMoveSaving(true)
    setLastMove({ from, to })

    const chess = new Chess(fenAfter)
    let newStatus = 'active'
    if (chess.isCheckmate()) {
      newStatus = selectedGame.white_email === myEmail ? 'white_won' : 'black_won'
    } else if (chess.isDraw()) {
      newStatus = 'draw'
    }

    const newExpires = new Date(Date.now() + FOURTEEN_DAYS_MS).toISOString()
    const newMoveRecord: MoveRecord = {
      id: Date.now().toString(), move_san: san,
      played_by_email: myEmail, created_at: new Date().toISOString(),
    }
    setMoveHistory(prev => [...prev, newMoveRecord])

    await Promise.all([
      supabase.from('chess_moves').insert({
        game_id: selectedGame.id, move_san: san,
        fen_after: fenAfter, played_by_email: myEmail,
      }),
      supabase.from('chess_games').update({
        fen: fenAfter, status: newStatus,
        last_move_at: new Date().toISOString(), expires_at: newExpires,
      }).eq('id', selectedGame.id),
    ])

    if (newStatus !== 'active') notify(newStatus === 'draw' ? "It's a draw!" : '🏆 Checkmate!')
    await fetchAll()
    setMoveSaving(false)
  }

  async function resignGame(game: Game) {
    const loserIsWhite = game.white_email === myEmail
    await supabase.from('chess_games').update({
      status: loserIsWhite ? 'black_won' : 'white_won',
    }).eq('id', game.id)
    notify('You resigned.')
    setSelectedGame(null)
    fetchAll()
  }

  const activeGames   = games.filter(g => g.status === 'active')
  const myTurnGames   = activeGames.filter(g => {
    const chess = new Chess(g.fen); const turn = chess.turn()
    return (turn === 'w' && g.white_email === myEmail) || (turn === 'b' && g.black_email === myEmail)
  })
  const theirTurnGames = activeGames.filter(g => !myTurnGames.includes(g))
  const finishedGames  = games.filter(g => g.status !== 'active').slice(0, 8)
  const opponents      = profiles.filter(p => p.email !== myEmail)

  function profileFor(email: string) { return profiles.find(p => p.email === email) }

  /* ─────────────── BOARD VIEW ─────────────── */
  if (selectedGame) {
    const chess     = new Chess(selectedGame.fen)
    const iAmWhite  = selectedGame.white_email === myEmail
    const myColor: 'w' | 'b' = iAmWhite ? 'w' : 'b'
    const isMyTurn  = chess.turn() === myColor && selectedGame.status === 'active'
    const isOver    = selectedGame.status !== 'active'
    const whiteProfile = profileFor(selectedGame.white_email)
    const blackProfile = profileFor(selectedGame.black_email)
    const opponent  = iAmWhite ? blackProfile : whiteProfile
    const expired   = isExpired(selectedGame.expires_at)

    const topPlayer    = iAmWhite ? blackProfile : whiteProfile   // opponent at top
    const bottomPlayer = iAmWhite ? whiteProfile : blackProfile   // me at bottom
    const topIsActive  = chess.turn() !== myColor && !isOver
    const botIsActive  = chess.turn() === myColor && !isOver

    const movePairs = pairMoves(moveHistory)

    let statusLine = ''
    if (isOver) {
      const r = gameResult(selectedGame, myEmail)
      statusLine = r === 'win' ? '🏆 You won!' : r === 'loss' ? 'You lost' : "½ Draw"
    } else if (expired) {
      statusLine = '⏰ Time expired'
    } else if (isMyTurn) {
      statusLine = 'Your move'
    } else {
      statusLine = `${opponent?.first_name ?? 'Opponent'}'s move · ${timeLeft(selectedGame.expires_at)}`
    }

    return (
      <AuthGuard>
        <div className="min-h-screen bg-[#312e2b] pb-24">

          {/* Slim header */}
          <div className="bg-[#262421] border-b border-black/30 px-4 py-3 flex items-center gap-3">
            <button onClick={() => { setSelectedGame(null); setLastMove(null); setMoveHistory([]) }}
              className="text-gray-400 hover:text-white text-xl leading-none transition-colors">
              ←
            </button>
            <p className="text-sm font-semibold text-gray-200 flex-1">
              {isOver
                ? (() => { const r = gameResult(selectedGame, myEmail); return r === 'win' ? '🏆 You won!' : r === 'loss' ? 'You lost' : "½ Draw" })()
                : isMyTurn ? 'Your move' : `${opponent?.first_name ?? 'Opponent'}'s move`}
            </p>
            {!isOver && (
              <button onClick={() => resignGame(selectedGame)}
                className="text-xs text-red-400 hover:text-red-300 border border-red-800 hover:border-red-600 px-3 py-1.5 rounded-lg transition-colors">
                Resign
              </button>
            )}
          </div>

          {/* Two-column on desktop, stacked on mobile */}
          <div className="flex flex-col lg:flex-row items-start justify-center gap-4 p-4 lg:p-8 max-w-6xl mx-auto">

            {/* ── Board column ── */}
            <div className="flex flex-col items-center gap-2 w-full lg:w-auto">
              {/* Opponent (top) */}
              <div className="w-full max-w-[480px]">
                <PlayerStrip profile={topPlayer} isActive={topIsActive} isYou={!iAmWhite && topPlayer?.email === myEmail || iAmWhite && false} timeStr={!isOver && topIsActive ? timeLeft(selectedGame.expires_at) : undefined} />
              </div>

              {/* Board */}
              <ChessBoard
                fen={selectedGame.fen}
                playerColor={myColor}
                lastMove={lastMove}
                disabled={!isMyTurn || moveSaving}
                onMove={handleMove}
              />

              {moveSaving && (
                <p className="text-xs text-gray-400 animate-pulse">Saving…</p>
              )}

              {/* Me (bottom) */}
              <div className="w-full max-w-[480px]">
                <PlayerStrip profile={bottomPlayer} isActive={botIsActive} isYou={true} timeStr={!isOver && botIsActive ? timeLeft(selectedGame.expires_at) : undefined} />
              </div>
            </div>

            {/* ── Right panel (desktop) ── */}
            <div className="w-full lg:w-64 flex flex-col gap-3">

              {/* Status card */}
              <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                isOver
                  ? gameResult(selectedGame, myEmail) === 'win'
                    ? 'bg-green-800 text-green-100'
                    : gameResult(selectedGame, myEmail) === 'loss'
                    ? 'bg-red-900 text-red-100'
                    : 'bg-gray-700 text-gray-200'
                  : isMyTurn
                  ? 'bg-[#769656] text-white'
                  : 'bg-[#262421] text-gray-300'
              }`}>
                {statusLine}
              </div>

              {/* Move history */}
              <div className="bg-[#262421] rounded-xl overflow-hidden flex-1">
                <div className="px-3 py-2 border-b border-white/10">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Moves</p>
                </div>
                <div className="overflow-y-auto max-h-72 lg:max-h-96">
                  {movePairs.length === 0 ? (
                    <p className="text-xs text-gray-600 px-3 py-4 text-center">No moves yet</p>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {movePairs.map(pair => (
                        <div key={pair.num} className="flex items-center text-sm">
                          <span className="w-8 text-center text-gray-600 text-xs py-1.5 shrink-0">{pair.num}.</span>
                          <span className="flex-1 px-2 py-1.5 text-gray-200 font-mono text-xs">{pair.w}</span>
                          <span className="flex-1 px-2 py-1.5 text-gray-200 font-mono text-xs">{pair.b}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Colors legend */}
              <div className="bg-[#262421] rounded-xl px-3 py-3 flex items-center justify-between text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-sm bg-white border border-gray-400" />
                  <span>{whiteProfile?.first_name ?? 'White'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-sm bg-gray-800 border border-gray-600" />
                  <span>{blackProfile?.first_name ?? 'Black'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Check banner */}
          {chess.inCheck() && !chess.isCheckmate() && (
            <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-red-600 text-white text-sm font-bold px-5 py-2 rounded-full shadow-lg z-50">
              Check!
            </div>
          )}

          {notification && (
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-white text-gray-900 text-sm font-semibold px-5 py-2.5 rounded-full shadow-xl z-50">
              {notification}
            </div>
          )}
        </div>
      </AuthGuard>
    )
  }

  /* ─────────────── MAIN LIST VIEW ─────────────── */
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 pb-24">

        <div className="bg-white border-b px-6 py-5">
          <h1 className="text-2xl font-bold text-gray-900">♟ Chess</h1>
          <p className="text-sm text-gray-500 mt-0.5">Correspondence chess · 2 weeks per move</p>
        </div>

        <div className="bg-white border-b px-6 flex gap-6">
          {(['games', 'leaderboard', 'challenge'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`py-3 text-sm font-semibold border-b-2 transition-colors capitalize ${
                tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}>
              {t === 'games' ? 'My Games' : t === 'leaderboard' ? 'Leaderboard' : 'Challenge'}
            </button>
          ))}
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          {loading ? (
            <p className="text-gray-400 text-sm text-center py-12">Loading…</p>
          ) : tab === 'games' ? (
            <div className="space-y-6">
              {myTurnGames.length > 0 && (
                <section>
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Your move ({myTurnGames.length})</h2>
                  <div className="space-y-2">
                    {myTurnGames.map(g => {
                      const opp = profileFor(g.white_email === myEmail ? g.black_email : g.white_email)
                      return (
                        <button key={g.id} onClick={() => openGame(g)}
                          className="w-full flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 hover:bg-indigo-100 transition-colors text-left">
                          <div className="w-10 h-10 rounded-full bg-[#769656] flex items-center justify-center text-white text-xl shrink-0">♟</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900">vs {opp?.first_name ?? '—'}</p>
                            <p className="text-xs text-indigo-600 font-medium">Your move · {timeLeft(g.expires_at)}</p>
                          </div>
                          <span className="text-indigo-400 text-lg">→</span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )}

              {theirTurnGames.length > 0 && (
                <section>
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Waiting on them ({theirTurnGames.length})</h2>
                  <div className="space-y-2">
                    {theirTurnGames.map(g => {
                      const opp = profileFor(g.white_email === myEmail ? g.black_email : g.white_email)
                      return (
                        <button key={g.id} onClick={() => openGame(g)}
                          className="w-full flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-3 hover:bg-gray-50 transition-colors text-left">
                          {opp
                            ? <img src={getAvatarUrl(opp.full_name)} alt={opp.first_name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                            : <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800">vs {opp?.first_name ?? '—'}</p>
                            <p className="text-xs text-gray-400">{opp?.first_name ?? 'Their'}'s move · {timeLeft(g.expires_at)}</p>
                          </div>
                          <span className="text-gray-300 text-lg">→</span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )}

              {finishedGames.length > 0 && (
                <section>
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Recent Results</h2>
                  <div className="space-y-2">
                    {finishedGames.map(g => {
                      const opp = profileFor(g.white_email === myEmail ? g.black_email : g.white_email)
                      const result = gameResult(g, myEmail)
                      return (
                        <div key={g.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3">
                          {opp
                            ? <img src={getAvatarUrl(opp.full_name)} alt={opp.first_name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                            : <div className="w-9 h-9 rounded-full bg-gray-200 shrink-0" />}
                          <p className="text-sm text-gray-700 flex-1">vs {opp?.first_name ?? '—'}</p>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                            result === 'win' ? 'bg-green-100 text-green-700' :
                            result === 'loss' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {result === 'win' ? 'Won' : result === 'loss' ? 'Lost' : 'Draw'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {activeGames.length === 0 && finishedGames.length === 0 && (
                <div className="text-center py-16">
                  <div className="text-5xl mb-4">♟</div>
                  <h2 className="text-xl font-bold text-gray-800 mb-2">No games yet</h2>
                  <p className="text-gray-500 text-sm mb-6">Challenge a family member to get started.</p>
                  <button onClick={() => setTab('challenge')}
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
                    Start a game
                  </button>
                </div>
              )}
            </div>

          ) : tab === 'leaderboard' ? (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2 bg-gray-50 border-b border-gray-100">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Player</span>
                <span className="text-xs font-bold text-green-600 uppercase tracking-wide w-10 text-center">W</span>
                <span className="text-xs font-bold text-red-500 uppercase tracking-wide w-10 text-center">L</span>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide w-10 text-center">D</span>
              </div>
              {leaderboard.map((row, i) => (
                <div key={row.email} className={`grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-4 py-3 border-b border-gray-50 last:border-0 ${row.email === myEmail ? 'bg-indigo-50' : ''}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-gray-300 w-4">{i + 1}</span>
                    <img src={getAvatarUrl(row.full_name)} alt={row.first_name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                    <span className="text-sm font-semibold text-gray-800 truncate">
                      {row.first_name}{row.email === myEmail && <span className="text-indigo-400 text-xs ml-1">(you)</span>}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-green-600 w-10 text-center">{row.wins}</span>
                  <span className="text-sm font-bold text-red-500 w-10 text-center">{row.losses}</span>
                  <span className="text-sm text-gray-400 w-10 text-center">{row.draws}</span>
                </div>
              ))}
              {leaderboard.every(r => r.wins + r.losses + r.draws === 0) && (
                <p className="px-4 py-8 text-center text-gray-400 text-sm">No completed games yet.</p>
              )}
            </div>

          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Who do you want to challenge?</label>
                <div className="space-y-2">
                  {opponents.map(p => (
                    <button key={p.email} onClick={() => setChallengeTarget(p.email)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-colors text-left ${
                        challengeTarget === p.email ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'
                      }`}>
                      <img src={getAvatarUrl(p.full_name)} alt={p.first_name} className="w-10 h-10 rounded-full object-cover" />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{p.first_name}</p>
                        <p className="text-xs text-gray-400">{p.full_name}</p>
                      </div>
                      {challengeTarget === p.email && <span className="ml-auto text-indigo-500 font-bold">✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Your color</label>
                <div className="flex gap-2">
                  {(['random', 'w', 'b'] as const).map(c => (
                    <button key={c} onClick={() => setChallengeColor(c)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-colors ${
                        challengeColor === c ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}>
                      {c === 'random' ? '🎲 Random' : c === 'w' ? '⬜ White' : '⬛ Black'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
                ⏰ Each player has <strong>2 weeks</strong> to make their move. Miss the deadline and you forfeit the game.
              </div>

              <button onClick={startChallenge} disabled={!challengeTarget || challenging}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors">
                {challenging ? 'Starting…' : 'Start Game'}
              </button>
            </div>
          )}
        </div>

        {notification && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-full shadow-lg z-50">
            {notification}
          </div>
        )}
      </div>
    </AuthGuard>
  )
}
