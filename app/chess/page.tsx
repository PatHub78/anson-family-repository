'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Chess } from 'chess.js'
import { createClient } from '@supabase/supabase-js'
import AuthGuard from '@/app/components/AuthGuard'
import ChessBoard, { LastMove } from '../components/chess/ChessBoard'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000

type Profile  = { email: string; full_name: string; first_name: string }
type Game     = {
  id: string; white_email: string; black_email: string; fen: string
  status: string; created_at: string; last_move_at: string; expires_at: string
}
type MoveRec  = { id: string; move_san: string; played_by_email: string; created_at: string }
type ChatMsg  = { id: string; game_id: string; sender_email: string; message: string; created_at: string }
type LBRow    = { email: string; first_name: string; full_name: string; wins: number; losses: number; draws: number }

function getAvatarUrl(fullName: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${fullName.toLowerCase().replaceAll(' ', '-')}.jpg`
}
function timeLeft(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const d = Math.floor(ms / 86_400_000), h = Math.floor((ms % 86_400_000) / 3_600_000)
  return d > 0 ? `${d}d ${h}h left` : `${h}h left`
}
function isExpired(e: string) { return new Date(e).getTime() < Date.now() }
function gameResult(g: Game, me: string) {
  if (g.status === 'active') return null
  if (g.status === 'draw')   return 'draw'
  return g.status === 'white_won' ? (g.white_email === me ? 'win' : 'loss')
       : g.status === 'black_won' ? (g.black_email === me ? 'win' : 'loss') : null
}
function pairMoves(moves: MoveRec[]) {
  return moves.reduce<{ num: number; w: string; b: string }[]>((acc, m, i) => {
    if (i % 2 === 0) acc.push({ num: acc.length + 1, w: m.move_san, b: '' })
    else acc[acc.length - 1].b = m.move_san
    return acc
  }, [])
}

function PlayerStrip({ profile, isActive, isYou, caption }: {
  profile?: Profile; isActive: boolean; isYou: boolean; caption?: string
}) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${isActive ? 'bg-[#BACA2B]/20' : ''}`}>
      {profile
        ? <img src={getAvatarUrl(profile.full_name)} alt={profile.first_name} className="w-9 h-9 rounded-full object-cover border-2 border-white/20 shadow-sm shrink-0" />
        : <div className="w-9 h-9 rounded-full bg-gray-600 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-200 leading-none">
          {profile?.first_name ?? '—'}
          {isYou && <span className="text-gray-500 font-normal text-xs ml-1">(you)</span>}
        </p>
        {caption && <p className="text-xs text-gray-500 mt-0.5">{caption}</p>}
      </div>
      {isActive && <span className="w-2.5 h-2.5 rounded-full bg-[#769656] shrink-0 animate-pulse" />}
    </div>
  )
}

export default function ChessPage() {
  const [tab, setTab]               = useState<'games' | 'all' | 'leaderboard' | 'challenge'>('games')
  const [myEmail, setMyEmail]       = useState('')
  const [profiles, setProfiles]     = useState<Profile[]>([])
  const [games, setGames]           = useState<Game[]>([])
  const [allGames, setAllGames]     = useState<Game[]>([])
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [moveHistory, setMoveHistory]   = useState<MoveRec[]>([])
  const [lastMove, setLastMove]         = useState<LastMove | null>(null)
  const [messages, setMessages]         = useState<ChatMsg[]>([])
  const [chatInput, setChatInput]       = useState('')
  const [sendingChat, setSendingChat]   = useState(false)
  const [leaderboard, setLeaderboard]   = useState<LBRow[]>([])
  const [loading, setLoading]           = useState(true)
  const [challengeTarget, setChallengeTarget] = useState('')
  const [challengeColor, setChallengeColor]   = useState<'w' | 'b' | 'random'>('random')
  const [challenging, setChallenging]   = useState(false)
  const [moveSaving, setMoveSaving]     = useState(false)
  const [notification, setNotification] = useState<string | null>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  function notify(msg: string) { setNotification(msg); setTimeout(() => setNotification(null), 3500) }

  // ── Fetch all data ──
  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const email = user?.email ?? ''
    setMyEmail(email)

    const [{ data: myGamesData }, { data: allGamesData }, { data: profilesData }] = await Promise.all([
      supabase.from('chess_games').select('*')
        .or(`white_email.eq.${email},black_email.eq.${email}`)
        .order('last_move_at', { ascending: false }),
      supabase.from('chess_games').select('*')
        .order('last_move_at', { ascending: false }),
      supabase.from('profiles').select('email, full_name, first_name'),
    ])

    setGames(myGamesData ?? [])
    setAllGames(allGamesData ?? [])
    setProfiles(profilesData ?? [])

    const rows: Record<string, LBRow> = {}
    ;(profilesData ?? []).forEach(p => { rows[p.email] = { ...p, wins: 0, losses: 0, draws: 0 } })
    ;(allGamesData ?? []).filter((g: Game) => g.status !== 'active').forEach((g: Game) => {
      const w = rows[g.white_email], b = rows[g.black_email]
      if (g.status === 'draw')       { if (w) w.draws++;  if (b) b.draws++ }
      else if (g.status === 'white_won') { if (w) w.wins++; if (b) b.losses++ }
      else if (g.status === 'black_won') { if (b) b.wins++; if (w) w.losses++ }
    })
    setLeaderboard(Object.values(rows).sort((a, b) => b.wins - a.wins || a.losses - b.losses))
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Keep selectedGame in sync when games list refreshes
  useEffect(() => {
    if (!selectedGame) return
    const updated = [...games, ...allGames].find(g => g.id === selectedGame.id)
    if (updated && updated.fen !== selectedGame.fen) setSelectedGame(updated)
  }, [games, allGames])

  // ── Real-time: current game updates ──
  useEffect(() => {
    if (!selectedGame) return
    const channel = supabase
      .channel(`game:${selectedGame.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chess_games', filter: `id=eq.${selectedGame.id}` },
        async (payload) => {
          setSelectedGame(payload.new as Game)
          // Re-fetch move history when the game updates
          const { data } = await supabase.from('chess_moves').select('*')
            .eq('game_id', selectedGame.id).order('created_at', { ascending: true })
          setMoveHistory(data ?? [])
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selectedGame?.id])

  // ── Real-time: chat messages ──
  useEffect(() => {
    if (!selectedGame) return
    const channel = supabase
      .channel(`chat:${selectedGame.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chess_messages', filter: `game_id=eq.${selectedGame.id}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new as ChatMsg])
          setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selectedGame?.id])

  // Scroll chat to bottom when messages load
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // ── Open a game ──
  async function openGame(game: Game) {
    setSelectedGame(game)
    setLastMove(null)
    const [{ data: movesData }, { data: chatData }] = await Promise.all([
      supabase.from('chess_moves').select('*').eq('game_id', game.id).order('created_at', { ascending: true }),
      supabase.from('chess_messages').select('*').eq('game_id', game.id).order('created_at', { ascending: true }),
    ])
    setMoveHistory(movesData ?? [])
    setMessages(chatData ?? [])
  }

  // ── Start challenge ──
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

    if (error) { notify('Could not start game. Try again.'); setChallenging(false); return }

    // Send invite email
    const myProfile  = profiles.find(p => p.email === myEmail)
    const oppProfile = profiles.find(p => p.email === challengeTarget)
    await fetch('/api/chess-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengerName:  myProfile?.first_name ?? myEmail,
        challengerEmail: myEmail,
        opponentEmail:   challengeTarget,
        opponentName:    oppProfile?.first_name ?? challengeTarget,
        challengerColor: assignColor,
      }),
    })

    notify(`Game started! Email sent to ${oppProfile?.first_name ?? 'them'}.`)
    setTab('games')
    fetchAll()
    setChallenging(false)
  }

  // ── Make a move ──
  async function handleMove(san: string, fenAfter: string, from: string, to: string) {
    if (!selectedGame || moveSaving) return
    setMoveSaving(true)
    setLastMove({ from, to })

    const chess = new Chess(fenAfter)
    let newStatus = 'active'
    if (chess.isCheckmate()) newStatus = selectedGame.white_email === myEmail ? 'white_won' : 'black_won'
    else if (chess.isDraw())  newStatus = 'draw'

    const newExpires  = new Date(Date.now() + FOURTEEN_DAYS_MS).toISOString()
    setMoveHistory(prev => [...prev, { id: Date.now().toString(), move_san: san, played_by_email: myEmail, created_at: new Date().toISOString() }])

    await Promise.all([
      supabase.from('chess_moves').insert({ game_id: selectedGame.id, move_san: san, fen_after: fenAfter, played_by_email: myEmail }),
      supabase.from('chess_games').update({ fen: fenAfter, status: newStatus, last_move_at: new Date().toISOString(), expires_at: newExpires }).eq('id', selectedGame.id),
    ])

    if (newStatus !== 'active') notify(newStatus === 'draw' ? "It's a draw!" : '🏆 Checkmate!')
    await fetchAll()
    setMoveSaving(false)
  }

  // ── Send chat ──
  async function sendChat() {
    if (!chatInput.trim() || !selectedGame || sendingChat) return
    setSendingChat(true)
    const text = chatInput.trim()
    setChatInput('')
    await supabase.from('chess_messages').insert({ game_id: selectedGame.id, sender_email: myEmail, message: text })
    setSendingChat(false)
  }

  // ── Resign ──
  async function resignGame(game: Game) {
    const loserIsWhite = game.white_email === myEmail
    await supabase.from('chess_games').update({ status: loserIsWhite ? 'black_won' : 'white_won' }).eq('id', game.id)
    notify('You resigned.')
    setSelectedGame(null)
    fetchAll()
  }

  const profileFor = (email: string) => profiles.find(p => p.email === email)

  const activeGames   = games.filter(g => g.status === 'active')
  const myTurnGames   = activeGames.filter(g => {
    const t = new Chess(g.fen).turn()
    return (t === 'w' && g.white_email === myEmail) || (t === 'b' && g.black_email === myEmail)
  })
  const theirTurnGames = activeGames.filter(g => !myTurnGames.includes(g))
  const finishedGames  = games.filter(g => g.status !== 'active').slice(0, 8)
  const opponents      = profiles.filter(p => p.email !== myEmail)

  /* ══════════════════════════════════════════
     BOARD VIEW
  ══════════════════════════════════════════ */
  if (selectedGame) {
    const chess       = new Chess(selectedGame.fen)
    const iAmWhite    = selectedGame.white_email === myEmail
    const myColor: 'w' | 'b' = iAmWhite ? 'w' : 'b'
    const isMyTurn    = chess.turn() === myColor && selectedGame.status === 'active'
    const isOver      = selectedGame.status !== 'active'
    const iAmSpectator = selectedGame.white_email !== myEmail && selectedGame.black_email !== myEmail
    const whiteProfile = profileFor(selectedGame.white_email)
    const blackProfile = profileFor(selectedGame.black_email)
    const opponent    = iAmWhite ? blackProfile : whiteProfile
    const topPlayer   = iAmWhite ? blackProfile : whiteProfile
    const botPlayer   = iAmWhite ? whiteProfile : blackProfile
    const topActive   = chess.turn() !== myColor && !isOver
    const botActive   = chess.turn() === myColor && !isOver

    let statusLine = ''
    if (isOver) {
      const r = gameResult(selectedGame, myEmail)
      statusLine = iAmSpectator
        ? (selectedGame.status === 'draw' ? '½ Draw' : selectedGame.status === 'white_won' ? `${whiteProfile?.first_name ?? 'White'} won` : `${blackProfile?.first_name ?? 'Black'} won`)
        : r === 'win' ? '🏆 You won!' : r === 'loss' ? 'You lost' : '½ Draw'
    } else if (isExpired(selectedGame.expires_at)) {
      statusLine = '⏰ Time expired'
    } else if (iAmSpectator) {
      statusLine = `${chess.turn() === 'w' ? whiteProfile?.first_name ?? 'White' : blackProfile?.first_name ?? 'Black'}'s move`
    } else {
      statusLine = isMyTurn ? 'Your move' : `${opponent?.first_name ?? 'Opponent'}'s move · ${timeLeft(selectedGame.expires_at)}`
    }

    return (
      <AuthGuard>
        <div className="min-h-screen bg-[#312e2b] pb-24">

          {/* Header */}
          <div className="bg-[#262421] border-b border-black/30 px-4 py-3 flex items-center gap-3">
            <button onClick={() => { setSelectedGame(null); setLastMove(null); setMoveHistory([]); setMessages([]) }}
              className="text-gray-400 hover:text-white text-xl leading-none transition-colors">←</button>
            <p className="text-sm font-semibold text-gray-200 flex-1">{statusLine}</p>
            {!isOver && !iAmSpectator && (
              <button onClick={() => resignGame(selectedGame)}
                className="text-xs text-red-400 hover:text-red-300 border border-red-800 hover:border-red-600 px-3 py-1.5 rounded-lg transition-colors">
                Resign
              </button>
            )}
            {iAmSpectator && <span className="text-xs text-gray-500 border border-gray-700 px-2 py-1 rounded-lg">Spectating</span>}
          </div>

          <div className="flex flex-col lg:flex-row items-start justify-center gap-4 p-4 lg:p-8 max-w-6xl mx-auto">

            {/* ── Board column ── */}
            <div className="flex flex-col items-center gap-2 w-full lg:w-auto">
              <div className="w-full" style={{ maxWidth: 'min(480px, calc(100vw - 32px))' }}>
                <PlayerStrip profile={topPlayer} isActive={topActive} isYou={topPlayer?.email === myEmail}
                  caption={!isOver && topActive ? timeLeft(selectedGame.expires_at) : undefined} />
              </div>

              <ChessBoard
                fen={selectedGame.fen}
                playerColor={iAmSpectator ? 'w' : myColor}
                lastMove={lastMove}
                disabled={!isMyTurn || moveSaving || iAmSpectator}
                onMove={handleMove}
              />

              {moveSaving && <p className="text-xs text-gray-500 animate-pulse">Saving…</p>}

              <div className="w-full" style={{ maxWidth: 'min(480px, calc(100vw - 32px))' }}>
                <PlayerStrip profile={botPlayer} isActive={botActive} isYou={botPlayer?.email === myEmail}
                  caption={!isOver && botActive ? timeLeft(selectedGame.expires_at) : undefined} />
              </div>
            </div>

            {/* ── Right panel ── */}
            <div className="w-full lg:w-64 flex flex-col gap-3">

              {/* Status */}
              <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                isOver
                  ? gameResult(selectedGame, myEmail) === 'win'  ? 'bg-green-800 text-green-100'
                  : gameResult(selectedGame, myEmail) === 'loss' ? 'bg-red-900 text-red-100'
                  : 'bg-gray-700 text-gray-200'
                  : isMyTurn ? 'bg-[#769656] text-white' : 'bg-[#262421] text-gray-300'
              }`}>{statusLine}</div>

              {/* Move history */}
              <div className="bg-[#262421] rounded-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-white/10">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Moves</p>
                </div>
                <div className="overflow-y-auto max-h-40 lg:max-h-56">
                  {pairMoves(moveHistory).length === 0
                    ? <p className="text-xs text-gray-600 px-3 py-3 text-center">No moves yet</p>
                    : pairMoves(moveHistory).map(pair => (
                      <div key={pair.num} className="flex items-center text-xs divide-x divide-white/5">
                        <span className="w-8 text-center text-gray-600 py-1 shrink-0">{pair.num}.</span>
                        <span className="flex-1 px-2 py-1 text-gray-200 font-mono">{pair.w}</span>
                        <span className="flex-1 px-2 py-1 text-gray-400 font-mono">{pair.b}</span>
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* Chat */}
              <div className="bg-[#262421] rounded-xl overflow-hidden flex flex-col">
                <div className="px-3 py-2 border-b border-white/10">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Chat</p>
                </div>
                <div className="overflow-y-auto max-h-40 lg:max-h-48 px-3 py-2 space-y-2">
                  {messages.length === 0
                    ? <p className="text-xs text-gray-600 text-center py-2">No messages yet</p>
                    : messages.map(msg => {
                        const sender = profileFor(msg.sender_email)
                        const isMe   = msg.sender_email === myEmail
                        return (
                          <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                            {sender && (
                              <img src={getAvatarUrl(sender.full_name)} alt={sender.first_name}
                                className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5" />
                            )}
                            <div className={`max-w-[80%] px-2.5 py-1.5 rounded-xl text-xs leading-snug ${
                              isMe ? 'bg-[#769656] text-white rounded-tr-sm' : 'bg-[#3d3a37] text-gray-200 rounded-tl-sm'
                            }`}>
                              {msg.message}
                            </div>
                          </div>
                        )
                      })
                  }
                  <div ref={chatBottomRef} />
                </div>
                <div className="flex gap-2 px-3 py-2 border-t border-white/10">
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendChat()}
                    placeholder="Say something…"
                    className="flex-1 bg-[#3d3a37] text-gray-200 text-xs rounded-lg px-3 py-2 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#769656]"
                  />
                  <button onClick={sendChat} disabled={!chatInput.trim() || sendingChat}
                    className="bg-[#769656] hover:bg-[#5e7a42] disabled:opacity-40 text-white text-xs font-semibold px-3 rounded-lg transition-colors">
                    ↑
                  </button>
                </div>
              </div>

            </div>
          </div>

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

  /* ══════════════════════════════════════════
     MAIN LIST VIEW
  ══════════════════════════════════════════ */

  function GameRow({ g, showResult }: { g: Game; showResult?: boolean }) {
    const iAmWhite = g.white_email === myEmail
    const oppEmail = iAmWhite ? g.black_email : g.white_email
    const opp      = profileFor(oppEmail)
    const myTurn   = myTurnGames.includes(g)
    const result   = gameResult(g, myEmail)
    return (
      <button onClick={() => openGame(g)}
        className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors text-left border ${
          myTurn ? 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100' : 'bg-white border-gray-200 hover:bg-gray-50'
        }`}>
        {opp
          ? <img src={getAvatarUrl(opp.full_name)} alt={opp.first_name} className="w-10 h-10 rounded-full object-cover shrink-0" />
          : <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">vs {opp?.first_name ?? oppEmail}</p>
          <p className={`text-xs ${myTurn ? 'text-indigo-600 font-medium' : 'text-gray-400'}`}>
            {showResult && result ? (result === 'win' ? 'You won' : result === 'loss' ? 'You lost' : 'Draw') : myTurn ? `Your move · ${timeLeft(g.expires_at)}` : `${opp?.first_name ?? 'Their'}'s move · ${timeLeft(g.expires_at)}`}
          </p>
        </div>
        {showResult && result && (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${
            result === 'win' ? 'bg-green-100 text-green-700' : result === 'loss' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
          }`}>{result === 'win' ? 'Won' : result === 'loss' ? 'Lost' : 'Draw'}</span>
        )}
        {!showResult && <span className={`text-lg ${myTurn ? 'text-indigo-400' : 'text-gray-300'}`}>→</span>}
      </button>
    )
  }

  function AllGameRow({ g }: { g: Game }) {
    const wp = profileFor(g.white_email)
    const bp = profileFor(g.black_email)
    const chess = new Chess(g.fen)
    const whose = chess.turn() === 'w' ? wp?.first_name ?? 'White' : bp?.first_name ?? 'Black'
    const isFinished = g.status !== 'active'
    return (
      <button onClick={() => openGame(g)}
        className="w-full flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 hover:bg-gray-50 transition-colors text-left">
        <div className="flex -space-x-2 shrink-0">
          {wp && <img src={getAvatarUrl(wp.full_name)} alt={wp.first_name} className="w-8 h-8 rounded-full object-cover border-2 border-white" />}
          {bp && <img src={getAvatarUrl(bp.full_name)} alt={bp.first_name} className="w-8 h-8 rounded-full object-cover border-2 border-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{wp?.first_name ?? '?'} vs {bp?.first_name ?? '?'}</p>
          <p className="text-xs text-gray-400">
            {isFinished
              ? g.status === 'draw' ? 'Draw' : g.status === 'white_won' ? `${wp?.first_name ?? 'White'} won` : `${bp?.first_name ?? 'Black'} won`
              : `${whose}'s move · ${timeLeft(g.expires_at)}`}
          </p>
        </div>
        <span className="text-xs text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full shrink-0">Watch</span>
      </button>
    )
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 pb-24">

        <div className="bg-white border-b px-6 py-5">
          <h1 className="text-2xl font-bold text-gray-900">♟ Chess</h1>
          <p className="text-sm text-gray-500 mt-0.5">Correspondence chess · 2 weeks per move</p>
        </div>

        <div className="bg-white border-b px-4 flex gap-1 overflow-x-auto">
          {(['games', 'all', 'leaderboard', 'challenge'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`py-3 px-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}>
              {t === 'games' ? 'My Games' : t === 'all' ? 'All Games' : t === 'leaderboard' ? 'Leaderboard' : 'Challenge'}
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
                  <div className="space-y-2">{myTurnGames.map(g => <GameRow key={g.id} g={g} />)}</div>
                </section>
              )}
              {theirTurnGames.length > 0 && (
                <section>
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Waiting on them ({theirTurnGames.length})</h2>
                  <div className="space-y-2">{theirTurnGames.map(g => <GameRow key={g.id} g={g} />)}</div>
                </section>
              )}
              {finishedGames.length > 0 && (
                <section>
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Recent Results</h2>
                  <div className="space-y-2">{finishedGames.map(g => <GameRow key={g.id} g={g} showResult />)}</div>
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

          ) : tab === 'all' ? (
            <div className="space-y-6">
              {(() => {
                const active   = allGames.filter(g => g.status === 'active')
                const finished = allGames.filter(g => g.status !== 'active').slice(0, 10)
                return (
                  <>
                    {active.length > 0 && (
                      <section>
                        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Active Games ({active.length})</h2>
                        <div className="space-y-2">{active.map(g => <AllGameRow key={g.id} g={g} />)}</div>
                      </section>
                    )}
                    {finished.length > 0 && (
                      <section>
                        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Completed</h2>
                        <div className="space-y-2">{finished.map(g => <AllGameRow key={g.id} g={g} />)}</div>
                      </section>
                    )}
                    {allGames.length === 0 && (
                      <p className="text-center text-gray-400 text-sm py-12">No games have been played yet.</p>
                    )}
                  </>
                )
              })()}
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
                ⏰ Each player has <strong>2 weeks</strong> to make their move. An email will be sent to your opponent when you start the game.
              </div>
              <button onClick={startChallenge} disabled={!challengeTarget || challenging}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors">
                {challenging ? 'Starting…' : 'Start Game & Send Invite'}
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
