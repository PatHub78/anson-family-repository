'use client'

import { useState } from 'react'
import { Chess } from 'chess.js'

// CBurnett piece set served from /public/pieces/
const PIECE_IMG: Record<string, string> = {
  wK: '/pieces/wK.svg', wQ: '/pieces/wQ.svg', wR: '/pieces/wR.svg',
  wB: '/pieces/wB.svg', wN: '/pieces/wN.svg', wP: '/pieces/wP.svg',
  bK: '/pieces/bK.svg', bQ: '/pieces/bQ.svg', bR: '/pieces/bR.svg',
  bB: '/pieces/bB.svg', bN: '/pieces/bN.svg', bP: '/pieces/bP.svg',
}

// Chess.com colour palette
const SQ_LIGHT        = '#EEEED2'
const SQ_DARK         = '#769656'
const SQ_LIGHT_HL     = '#F6F669'   // selected / last-move on a light square
const SQ_DARK_HL      = '#BACA2B'   // selected / last-move on a dark square
const SQ_LIGHT_CHECK  = '#FF6B6B'
const SQ_DARK_CHECK   = '#CC3333'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1']

type PromoPiece = 'q' | 'r' | 'b' | 'n'

export type LastMove = { from: string; to: string }

type Props = {
  fen: string
  playerColor: 'w' | 'b'
  lastMove?: LastMove | null
  disabled?: boolean
  onMove: (san: string, fenAfter: string, from: string, to: string) => void
}

function squareIsLight(file: string, rank: string) {
  return (FILES.indexOf(file) + parseInt(rank)) % 2 !== 0
}

export default function ChessBoard({ fen, playerColor, lastMove, disabled, onMove }: Props) {
  const [selected, setSelected]         = useState<string | null>(null)
  const [legalTargets, setLegalTargets] = useState<string[]>([])
  const [promoSquare, setPromoSquare]   = useState<string | null>(null)
  const [pendingFrom, setPendingFrom]   = useState<string | null>(null)

  const chess  = new Chess(fen)
  const board  = chess.board()

  // Flip board so current player's pieces are at bottom
  const ranks = playerColor === 'b' ? [...RANKS].reverse() : RANKS
  const files = playerColor === 'b' ? [...FILES].reverse() : FILES

  function getPiece(file: string, rank: string) {
    const ri = 8 - parseInt(rank)
    const fi = FILES.indexOf(file)
    return board[ri]?.[fi] ?? null
  }

  function squareBg(sq: string, file: string, rank: string): string {
    const light = squareIsLight(file, rank)
    const isHL  = selected === sq || lastMove?.from === sq || lastMove?.to === sq

    // King-in-check highlight
    const piece = chess.get(sq as any)
    if (chess.inCheck() && piece?.type === 'k' && piece.color === chess.turn()) {
      return light ? SQ_LIGHT_CHECK : SQ_DARK_CHECK
    }
    if (isHL) return light ? SQ_LIGHT_HL : SQ_DARK_HL
    return light ? SQ_LIGHT : SQ_DARK
  }

  function handleClick(sq: string) {
    if (disabled || promoSquare) return
    if (chess.turn() !== playerColor) return

    // Deselect
    if (selected === sq) { setSelected(null); setLegalTargets([]); return }

    // Execute move
    if (selected && legalTargets.includes(sq)) {
      const piece  = chess.get(selected as any)
      const toRank = sq[1]
      const isPawnPromo =
        piece?.type === 'p' &&
        ((playerColor === 'w' && toRank === '8') || (playerColor === 'b' && toRank === '1'))

      if (isPawnPromo) {
        setPendingFrom(selected); setPromoSquare(sq)
        setSelected(null); setLegalTargets([])
      } else {
        applyMove(selected, sq)
      }
      return
    }

    // Select a piece
    const piece = chess.get(sq as any)
    if (piece?.color === playerColor) {
      const moves = chess.moves({ square: sq as any, verbose: true })
      setSelected(sq)
      setLegalTargets(moves.map((m: any) => m.to))
    } else {
      setSelected(null); setLegalTargets([])
    }
  }

  function applyMove(from: string, to: string, promotion?: PromoPiece) {
    try {
      const result = chess.move({ from: from as any, to: to as any, promotion })
      if (result) {
        setSelected(null); setLegalTargets([])
        onMove(result.san, chess.fen(), from, to)
      }
    } catch {
      setSelected(null); setLegalTargets([])
    }
  }

  function handlePromo(p: PromoPiece) {
    if (pendingFrom && promoSquare) applyMove(pendingFrom, promoSquare, p)
    setPendingFrom(null); setPromoSquare(null)
  }

  const SQ = 56  // square size in px

  return (
    <div className="select-none inline-block">
      {/* Promotion picker */}
      {promoSquare && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-5 shadow-2xl text-center">
            <p className="text-sm font-semibold text-gray-700 mb-4">Promote to:</p>
            <div className="flex gap-3">
              {(['q', 'r', 'b', 'n'] as PromoPiece[]).map(p => (
                <button key={p} onClick={() => handlePromo(p)}
                  className="w-14 h-14 hover:bg-gray-100 rounded-xl flex items-center justify-center border-2 border-gray-200 hover:border-gray-400 transition-colors">
                  <img src={PIECE_IMG[playerColor + p.toUpperCase()]} alt={p} className="w-10 h-10" draggable={false} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Board */}
      <div className="rounded-sm overflow-hidden" style={{ boxShadow: '0 4px 28px rgba(0,0,0,0.4)' }}>
        {ranks.map(rank => (
          <div key={rank} className="flex">
            {/* Rank label — sits inside the first square, top-left */}
            <div style={{ width: 18, flexShrink: 0, background: squareBg(`a${rank}`, playerColor === 'b' ? 'h' : 'a', rank), position: 'relative' }}>
              <span style={{
                position: 'absolute', top: 2, left: 3,
                fontSize: 11, fontWeight: 700, lineHeight: 1,
                color: squareIsLight(playerColor === 'b' ? 'h' : 'a', rank) ? SQ_DARK : SQ_LIGHT,
                pointerEvents: 'none', userSelect: 'none',
              }}>{rank}</span>
            </div>

            {files.map((file, fi) => {
              const sq      = file + rank
              const piece   = getPiece(file, rank)
              const isTarget = legalTargets.includes(sq)
              const bg      = squareBg(sq, file, rank)
              const light   = squareIsLight(file, rank)

              return (
                <button key={sq} onClick={() => handleClick(sq)}
                  className="relative flex items-center justify-center focus:outline-none"
                  style={{ width: SQ, height: SQ, background: bg }}
                >
                  {/* File label on bottom rank */}
                  {rank === (playerColor === 'b' ? '8' : '1') && (
                    <span style={{
                      position: 'absolute', bottom: 2, right: 3,
                      fontSize: 11, fontWeight: 700, lineHeight: 1,
                      color: light ? SQ_DARK : SQ_LIGHT,
                      pointerEvents: 'none', userSelect: 'none',
                    }}>{file}</span>
                  )}

                  {/* Legal move indicator */}
                  {isTarget && !piece && (
                    <div className="rounded-full pointer-events-none"
                      style={{ width: 18, height: 18, background: 'rgba(0,0,0,0.22)' }} />
                  )}
                  {isTarget && piece && (
                    <div className="absolute inset-0 pointer-events-none rounded-full"
                      style={{ boxShadow: 'inset 0 0 0 4px rgba(0,0,0,0.3)' }} />
                  )}

                  {/* Piece image */}
                  {piece && (
                    <img
                      src={PIECE_IMG[piece.color + piece.type.toUpperCase()]}
                      alt={piece.type}
                      draggable={false}
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                      style={{ padding: 3 }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
