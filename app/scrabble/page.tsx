'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import AuthGuard from '@/app/components/AuthGuard'
import {
  BONUS_SQUARES, BONUS_COLORS, BONUS_LABELS,
  LETTER_VALUES, createInitialBag, createInitialBoard,
  drawTiles, isBoardEmpty, validateAndScore,
  type Board, type PlacedTile,
} from '@/app/lib/scrabble'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

function getAvatarUrl(fullName: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${fullName.toLowerCase().replaceAll(' ', '-')}.jpg`
}

type Profile = { email: string; full_name: string; first_name: string }

type GameRow = {
  id: string
  status: 'active' | 'finished'
  board: Board
  bag: string[]
  last_player_email: string | null
  winner_email: string | null
  final_round_started: boolean
  final_round_remaining: string[]
}

type PlayerRow = {
  game_id: string
  user_email: string
  rack: string[]
  score: number
}

export default function ScrabblePage() {
  const [myEmail,    setMyEmail]    = useState('')
  const [profiles,   setProfiles]   = useState<Profile[]>([])
  const [game,       setGame]       = useState<GameRow | null>(null)
  const [players,    setPlayers]    = useState<PlayerRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [busy,       setBusy]       = useState(false)
  const [notice,     setNotice]     = useState<string | null>(null)

  // Local placement state
  const [placed,         setPlaced]         = useState<PlacedTile[]>([])
  const [selectedRackIdx, setSelectedRackIdx] = useState<number | null>(null)

  // ── Notify helper
  function notify(msg: string) {
    setNotice(msg)
    setTimeout(() => setNotice(null), 3500)
  }

  // ── Boot
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setMyEmail(user?.email ?? '')
      const { data: profs } = await supabase.from('profiles').select('email, full_name, first_name')
      setProfiles(profs ?? [])
      await fetchGame()
      setLoading(false)
    })()
  }, [])

  // ── Fetch current game + players
  const fetchGame = useCallback(async () => {
    const { data: games } = await supabase
      .from('scrabble_game')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
    if (!games || games.length === 0) {
      setGame(null); setPlayers([]); return
    }
    const g = games[0] as GameRow
    setGame(g)
    const { data: pls } = await supabase
      .from('scrabble_players')
      .select('*')
      .eq('game_id', g.id)
    setPlayers(pls ?? [])
  }, [])

  // ── Realtime — refresh on any change
  useEffect(() => {
    if (!game?.id) return
    const ch = supabase
      .channel(`scrabble:${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scrabble_game',    filter: `id=eq.${game.id}` },      () => fetchGame())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scrabble_players', filter: `game_id=eq.${game.id}` }, () => fetchGame())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [game?.id, fetchGame])

  // ── Start a fresh game
  async function startNewGame() {
    if (busy) return
    setBusy(true)
    const bag = createInitialBag()
    const board = createInitialBoard()
    // Delete old game (cascades players)
    if (game) await supabase.from('scrabble_game').delete().eq('id', game.id)
    const { data: newG, error } = await supabase
      .from('scrabble_game')
      .insert({ status: 'active', board, bag, last_player_email: null })
      .select()
      .single()
    if (error || !newG) { notify('Could not start game'); setBusy(false); return }
    setGame(newG as GameRow)
    setPlayers([])
    setPlaced([])
    setSelectedRackIdx(null)
    setBusy(false)
    notify('New game started — join in!')
  }

  // ── Join the game (draw 7 tiles)
  async function joinGame() {
    if (!game || busy) return
    setBusy(true)
    const { drawn, remaining } = drawTiles(game.bag, 7)
    const { error: pErr } = await supabase
      .from('scrabble_players')
      .insert({ game_id: game.id, user_email: myEmail, rack: drawn, score: 0 })
    if (pErr) {
      notify('Could not join: ' + pErr.message)
      setBusy(false)
      return
    }
    await supabase.from('scrabble_game').update({ bag: remaining, updated_at: new Date().toISOString() }).eq('id', game.id)
    await fetchGame()
    setBusy(false)
    notify("You're in! Your tiles are at the bottom.")
  }

  // ── Leave the game
  async function leaveGame() {
    if (!game || busy) return
    if (!confirm('Leave the game? Your tiles go back in the bag.')) return
    setBusy(true)
    const me = players.find(p => p.user_email === myEmail)
    if (me) {
      // Return tiles to bag (shuffle)
      const newBag = [...game.bag, ...me.rack]
      for (let i = newBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[newBag[i], newBag[j]] = [newBag[j], newBag[i]]
      }
      await supabase.from('scrabble_players').delete().eq('game_id', game.id).eq('user_email', myEmail)
      await supabase.from('scrabble_game').update({ bag: newBag }).eq('id', game.id)
    }
    await fetchGame()
    setBusy(false)
  }

  // ── Tile interaction
  function clickRackTile(idx: number) {
    if (!isMyTurn) return
    setSelectedRackIdx(prev => prev === idx ? null : idx)
  }

  function clickBoardSquare(row: number, col: number) {
    if (!isMyTurn || !game || !me) return

    // If there's a placed-this-turn tile here, take it back
    const existing = placed.find(p => p.row === row && p.col === col)
    if (existing) {
      setPlaced(prev => prev.filter(p => !(p.row === row && p.col === col)))
      setSelectedRackIdx(null)
      return
    }

    // Square has an existing committed tile → ignore
    if (game.board[row][col] !== null) return

    // Need a selected rack tile to place
    if (selectedRackIdx === null) return

    // Don't allow placing if this rack tile is already placed
    if (placed.some(p => p.rackIdx === selectedRackIdx)) return

    const letter = me.rack[selectedRackIdx]
    setPlaced(prev => [...prev, { row, col, letter, rackIdx: selectedRackIdx }])
    setSelectedRackIdx(null)
  }

  // ── Submit the move
  async function submitMove() {
    if (!game || !me || busy) return
    if (placed.length === 0) { notify('Place at least one tile'); return }

    const firstMove = isBoardEmpty(game.board)
    const result = validateAndScore(game.board, placed, firstMove)
    if (!result.valid) { notify(result.error); return }

    setBusy(true)

    // Apply tiles to board
    const newBoard = game.board.map(r => [...r])
    for (const p of placed) {
      newBoard[p.row][p.col] = { letter: p.letter, player_email: myEmail }
    }

    // Remove used tiles from rack, draw replacements
    const usedRackIdx = new Set(placed.map(p => p.rackIdx))
    const newRack = me.rack.filter((_, i) => !usedRackIdx.has(i))
    const tilesToDraw = Math.min(7 - newRack.length, game.bag.length)
    const { drawn, remaining } = drawTiles(game.bag, tilesToDraw)
    const finalRack = [...newRack, ...drawn]

    // Determine if game should end
    let newStatus: 'active' | 'finished' = 'active'
    let winnerEmail: string | null = null
    let finalRoundStarted = game.final_round_started
    let finalRoundRemaining = [...(game.final_round_remaining || [])]

    const usedAllTiles = finalRack.length === 0 && remaining.length === 0

    if (usedAllTiles) {
      // Game ends — calculate winner
      newStatus = 'finished'
      const finalScores = players.map(p => ({
        email: p.user_email,
        score: p.user_email === myEmail ? p.score + result.score : p.score,
      }))
      winnerEmail = finalScores.sort((a, b) => b.score - a.score)[0]?.email ?? null
    } else if (remaining.length === 0 && !finalRoundStarted) {
      // Bag just emptied → trigger final round
      finalRoundStarted = true
      finalRoundRemaining = players.filter(p => p.user_email !== myEmail).map(p => p.user_email)
    } else if (finalRoundStarted) {
      // Already in final round → take this player off the list
      finalRoundRemaining = finalRoundRemaining.filter(e => e !== myEmail)
      if (finalRoundRemaining.length === 0) {
        newStatus = 'finished'
        const finalScores = players.map(p => ({
          email: p.user_email,
          score: p.user_email === myEmail ? p.score + result.score : p.score,
        }))
        winnerEmail = finalScores.sort((a, b) => b.score - a.score)[0]?.email ?? null
      }
    }

    // Update player + game
    await supabase.from('scrabble_players').update({
      rack: finalRack,
      score: me.score + result.score,
    }).eq('game_id', game.id).eq('user_email', myEmail)

    await supabase.from('scrabble_game').update({
      board: newBoard,
      bag: remaining,
      last_player_email: myEmail,
      status: newStatus,
      winner_email: winnerEmail,
      final_round_started: finalRoundStarted,
      final_round_remaining: finalRoundRemaining,
      updated_at: new Date().toISOString(),
    }).eq('id', game.id)

    notify(`+${result.score} pts — ${result.words.join(', ')}`)
    setPlaced([])
    setSelectedRackIdx(null)
    await fetchGame()
    setBusy(false)
  }

  function cancelPlacement() {
    setPlaced([])
    setSelectedRackIdx(null)
  }

  // ── Derived state
  const me = players.find(p => p.user_email === myEmail)
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score)
  const profileFor = (email: string) => profiles.find(p => p.email === email)

  const otherPlayersExist = players.length > 1
  const isMyTurn = !!me && !!game && game.status === 'active' && (
    game.last_player_email !== myEmail || !otherPlayersExist
  ) && (
    !game.final_round_started || (game.final_round_remaining || []).includes(myEmail)
  )

  // ── Loading / no-game states
  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-amber-50 flex items-center justify-center">
          <p className="text-amber-700 text-sm">Loading…</p>
        </div>
      </AuthGuard>
    )
  }

  if (!game) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-amber-50 flex flex-col items-center justify-center px-6 pb-24">
          <div className="text-6xl mb-4">🔤</div>
          <h1 className="text-3xl font-bold text-amber-900 mb-2">Family Scrabble</h1>
          <p className="text-amber-700 text-sm mb-6 text-center max-w-sm">No game in progress. Start a new one and the whole family can join.</p>
          <button onClick={startNewGame} disabled={busy}
            className="bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold px-8 py-3 rounded-xl transition-colors shadow-md">
            {busy ? 'Starting…' : '🔤 Start New Game'}
          </button>
        </div>
      </AuthGuard>
    )
  }

  // ── Game finished state
  if (game.status === 'finished') {
    const winner = profileFor(game.winner_email ?? '')
    return (
      <AuthGuard>
        <div className="min-h-screen bg-amber-50 flex flex-col items-center px-6 pt-10 pb-24">
          <div className="text-7xl mb-4">🏆</div>
          <h1 className="text-3xl font-bold text-amber-900 mb-2">Game Over!</h1>
          <p className="text-amber-700 mb-8">{winner?.first_name ?? game.winner_email} wins</p>

          <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-5 mb-6">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Final Scoreboard</h2>
            {sortedPlayers.map((p, i) => {
              const pr = profileFor(p.user_email)
              return (
                <div key={p.user_email} className={`flex items-center gap-3 py-2 ${i < sortedPlayers.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                    i === 0 ? 'bg-yellow-400 text-yellow-900' :
                    i === 1 ? 'bg-gray-300 text-gray-700' :
                    i === 2 ? 'bg-amber-600 text-white' :
                    'bg-gray-100 text-gray-500'
                  }`}>{i + 1}</span>
                  {pr && <img src={getAvatarUrl(pr.full_name)} alt={pr.first_name} className="w-8 h-8 rounded-full object-cover" />}
                  <span className="flex-1 font-semibold text-gray-800">{pr?.first_name ?? p.user_email}</span>
                  <span className="text-xl font-bold text-amber-700">{p.score}</span>
                </div>
              )
            })}
          </div>

          <button onClick={startNewGame} disabled={busy}
            className="bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold px-8 py-3 rounded-xl shadow-md">
            {busy ? 'Starting…' : 'Play Again'}
          </button>
        </div>
      </AuthGuard>
    )
  }

  // ── Active game
  return (
    <AuthGuard>
      <div className="min-h-screen bg-amber-50 pb-32 md:pb-20">

        {/* Header */}
        <div className="bg-white border-b border-amber-200 px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-amber-900">🔤 Family Scrabble</h1>
            <p className="text-xs text-amber-700">
              {game.bag.length} tiles left {game.final_round_started && '· FINAL ROUND'}
            </p>
          </div>
          {me && (
            <button onClick={leaveGame} disabled={busy}
              className="text-xs text-red-500 hover:text-red-600 font-medium">Leave</button>
          )}
        </div>

        {/* BIG join CTA — only when you haven't joined yet */}
        {!me && (
          <div className="bg-gradient-to-br from-amber-500 to-amber-700 text-white px-6 py-6 text-center shadow-md">
            <p className="text-sm font-semibold opacity-90 mb-1">You're not playing yet</p>
            <h2 className="text-2xl font-black mb-3">Tap below to join the game</h2>
            <button
              onClick={joinGame}
              disabled={busy || game.bag.length < 7}
              className="bg-white text-amber-700 hover:bg-amber-50 disabled:opacity-40 font-black text-lg px-8 py-4 rounded-2xl shadow-lg transition-all active:scale-95"
            >
              {busy ? 'Joining…' : '🎲 Join the game'}
            </button>
            <p className="text-xs opacity-80 mt-3">
              You'll get 7 random tiles to play with
            </p>
          </div>
        )}

        {/* Scoreboard strip */}
        <div className="bg-white border-b border-amber-200 px-4 py-2 flex gap-3 overflow-x-auto">
          {sortedPlayers.map(p => {
            const pr = profileFor(p.user_email)
            const isLast = game.last_player_email === p.user_email
            const isYou = p.user_email === myEmail
            return (
              <div key={p.user_email} className={`flex items-center gap-2 px-3 py-1.5 rounded-full whitespace-nowrap shrink-0 ${
                isLast ? 'bg-amber-100' : 'bg-gray-50'
              }`}>
                {pr && <img src={getAvatarUrl(pr.full_name)} alt={pr.first_name} className="w-6 h-6 rounded-full object-cover" />}
                <span className="text-xs font-semibold text-gray-800">{pr?.first_name ?? p.user_email}{isYou && ' (you)'}</span>
                <span className="text-xs font-bold text-amber-700">{p.score}</span>
              </div>
            )
          })}
          {players.length === 0 && (
            <p className="text-xs text-gray-400 italic py-1.5">Waiting for players…</p>
          )}
        </div>

        {/* Board */}
        <div className="flex justify-center px-2 py-3">
          <div className="inline-block bg-amber-900 p-1 rounded-md shadow-lg">
            {game.board.map((row, r) => (
              <div key={r} className="flex">
                {row.map((cell, c) => {
                  const placedHere = placed.find(p => p.row === r && p.col === c)
                  const bonus = BONUS_SQUARES[`${r},${c}`]
                  const isOccupied = cell !== null || placedHere
                  const isLegalTarget = isMyTurn && !cell && selectedRackIdx !== null && !placedHere
                  const sz = 'min(28px, calc((100vw - 32px) / 15))'

                  let bg = '#fef3c7' // empty cream
                  if (bonus && !isOccupied) bg = BONUS_COLORS[bonus]
                  if (placedHere) bg = '#fbbf24'  // gold for placed-this-turn
                  else if (cell) bg = '#fef3c7'

                  return (
                    <button
                      key={c}
                      onClick={() => clickBoardSquare(r, c)}
                      className="flex items-center justify-center relative border border-amber-900/30 transition-transform active:scale-95"
                      style={{ width: sz, height: sz, background: bg, fontSize: 'min(14px, calc((100vw - 32px) / 15 * 0.6))' }}
                    >
                      {!isOccupied && bonus && (
                        <span className="text-[7px] font-bold text-white opacity-80 leading-none">{BONUS_LABELS[bonus]}</span>
                      )}
                      {(cell || placedHere) && (
                        <span className="font-black text-amber-950 leading-none">
                          {placedHere?.letter ?? cell?.letter}
                        </span>
                      )}
                      {isLegalTarget && (
                        <div className="absolute inset-0 ring-2 ring-amber-600 ring-inset rounded-sm" />
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* How-to-play hint for first-timers (board is empty + you just joined) */}
        {me && isBoardEmpty(game.board) && placed.length === 0 && (
          <div className="mx-4 mb-3 bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-900">
            <p className="font-semibold mb-1">👋 How to play:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-xs">
              <li>Tap a letter at the bottom — it lifts up</li>
              <li>Tap an empty board square to place it</li>
              <li>Place more letters to spell a word</li>
              <li>Tap <strong>Submit</strong> to score it</li>
            </ol>
            <p className="text-xs mt-2 italic">First word must cover the center pink square ★</p>
          </div>
        )}

        {/* BIG sticky confirm banner at TOP when tiles are placed — impossible to miss */}
        {me && placed.length > 0 && (
          <div className="sticky top-0 z-50 bg-amber-600 text-white shadow-lg flex items-center gap-2 px-3 py-2">
            <span className="text-sm font-semibold flex-1">
              {placed.length} {placed.length === 1 ? 'tile' : 'tiles'} placed
            </span>
            <button
              onClick={cancelPlacement}
              disabled={busy}
              className="bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-3 py-1.5 rounded-lg"
            >
              ✕ Cancel
            </button>
            <button
              onClick={submitMove}
              disabled={busy || !isMyTurn}
              className="bg-white text-amber-700 font-black px-4 py-1.5 rounded-lg shadow active:scale-95"
            >
              {busy ? '…' : '✓ Submit'}
            </button>
          </div>
        )}

        {/* Compact rack at bottom — single row, fits any phone */}
        {me && (
          <div className="fixed bottom-16 md:bottom-0 left-0 right-0 bg-white border-t-2 border-amber-300 shadow-lg px-2 py-2 z-40 max-w-xl mx-auto">
            {me.rack.length === 0 ? (
              <div className="flex items-center justify-between px-2 py-1">
                <p className="text-xs text-gray-500">No tiles loaded</p>
                <button onClick={() => fetchGame()} className="text-xs text-indigo-600 font-semibold">🔄 Refresh</button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <div className="flex gap-1 overflow-x-auto flex-1">
                  {me.rack.map((letter, idx) => {
                    const isUsed = placed.some(p => p.rackIdx === idx)
                    const isSelected = selectedRackIdx === idx
                    return (
                      <button
                        key={idx}
                        disabled={isUsed || !isMyTurn}
                        onClick={() => clickRackTile(idx)}
                        className={`shrink-0 rounded-md flex flex-col items-center justify-center font-black text-amber-950 transition-all shadow-sm ${
                          isUsed ? 'bg-gray-200 opacity-40' :
                          isSelected ? 'bg-yellow-400 -translate-y-1 ring-2 ring-amber-600' :
                          'bg-amber-200 hover:bg-amber-300'
                        }`}
                        style={{ width: 40, height: 46 }}
                      >
                        <span className="text-lg leading-none">{letter}</span>
                        <span className="text-[8px] leading-none mt-0.5">{LETTER_VALUES[letter] ?? 0}</span>
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={submitMove}
                  disabled={busy || !isMyTurn || placed.length === 0}
                  className="shrink-0 bg-amber-600 hover:bg-amber-700 disabled:opacity-30 text-white font-bold px-3 rounded-md shadow-md self-stretch text-xs"
                >
                  {busy ? '…' : placed.length === 0 ? (isMyTurn ? '▲' : 'Wait') : `✓ ${placed.length}`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Notice toast — positioned above the rack (which sits above the nav bar on mobile) */}
        {notice && (
          <div className="fixed bottom-48 md:bottom-32 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-xl z-50">
            {notice}
          </div>
        )}
      </div>
    </AuthGuard>
  )
}
