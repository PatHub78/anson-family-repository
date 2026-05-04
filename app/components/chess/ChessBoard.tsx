'use client'

import { useState, useEffect } from 'react'
import { Chess } from 'chess.js'

const PIECE_GLYPHS: Record<string, string> = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1']

type PromoPiece = 'q' | 'r' | 'b' | 'n'

type Props = {
  fen: string
  playerColor: 'w' | 'b'         // which side this user plays
  disabled?: boolean               // true when it's not their turn
  onMove: (san: string, fenAfter: string) => void
}

export default function ChessBoard({ fen, playerColor, disabled, onMove }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [legalTargets, setLegalTargets] = useState<string[]>([])
  const [promoSquare, setPromoSquare] = useState<string | null>(null)
  const [pendingFrom, setPendingFrom] = useState<string | null>(null)

  const chess = new Chess(fen)
  const board = chess.board() // 8×8 array, rank 8 first

  // flip board so current player's pieces are at the bottom
  const ranks = playerColor === 'b' ? [...RANKS].reverse() : RANKS
  const files = playerColor === 'b' ? [...FILES].reverse() : FILES

  function squareColor(file: string, rank: string) {
    const fileIdx = FILES.indexOf(file)
    const rankIdx = parseInt(rank) - 1
    return (fileIdx + rankIdx) % 2 === 0 ? 'dark' : 'light'
  }

  function getPiece(file: string, rank: string) {
    const rankIdx = 8 - parseInt(rank)   // board[0] = rank 8
    const fileIdx = FILES.indexOf(file)
    return board[rankIdx][fileIdx]
  }

  function handleSquareClick(square: string) {
    if (disabled) return
    if (chess.turn() !== playerColor) return

    // If we're waiting for promotion choice, ignore board clicks
    if (promoSquare) return

    if (selected === square) {
      // Deselect
      setSelected(null)
      setLegalTargets([])
      return
    }

    if (selected && legalTargets.includes(square)) {
      // Attempt the move
      const moveAttempt = { from: selected, to: square }

      // Check if this is a pawn promotion
      const piece = chess.get(selected as any)
      const toRank = square[1]
      const isPawnPromo =
        piece?.type === 'p' &&
        ((playerColor === 'w' && toRank === '8') || (playerColor === 'b' && toRank === '1'))

      if (isPawnPromo) {
        setPendingFrom(selected)
        setPromoSquare(square)
        setSelected(null)
        setLegalTargets([])
        return
      }

      applyMove(selected, square)
      return
    }

    // Select a piece
    const piece = chess.get(square as any)
    if (piece && piece.color === playerColor) {
      const moves = chess.moves({ square: square as any, verbose: true })
      setSelected(square)
      setLegalTargets(moves.map((m: any) => m.to))
    } else {
      setSelected(null)
      setLegalTargets([])
    }
  }

  function applyMove(from: string, to: string, promotion?: PromoPiece) {
    try {
      const result = chess.move({ from: from as any, to: to as any, promotion })
      if (result) {
        setSelected(null)
        setLegalTargets([])
        onMove(result.san, chess.fen())
      }
    } catch {
      setSelected(null)
      setLegalTargets([])
    }
  }

  function handlePromoChoice(piece: PromoPiece) {
    if (pendingFrom && promoSquare) {
      applyMove(pendingFrom, promoSquare, piece)
    }
    setPendingFrom(null)
    setPromoSquare(null)
  }

  const isCheck = chess.inCheck()
  const kingSquare = isCheck
    ? (() => {
        for (const r of board) for (const cell of r) {
          if (cell?.type === 'k' && cell.color === chess.turn()) {
            const ri = board.indexOf(board.find(row => row.includes(cell))!)
            const fi = board[ri].indexOf(cell)
            return FILES[fi] + (8 - ri)
          }
        }
        return null
      })()
    : null

  return (
    <div className="select-none">
      {/* Promotion modal */}
      {promoSquare && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 shadow-xl text-center">
            <p className="text-sm font-semibold text-gray-700 mb-4">Promote pawn to:</p>
            <div className="flex gap-3">
              {(['q', 'r', 'b', 'n'] as PromoPiece[]).map(p => (
                <button
                  key={p}
                  onClick={() => handlePromoChoice(p)}
                  className="w-14 h-14 bg-gray-50 hover:bg-indigo-50 border-2 border-gray-200 hover:border-indigo-400 rounded-xl flex items-center justify-center text-3xl transition-colors"
                >
                  {PIECE_GLYPHS[playerColor + p.toUpperCase()]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Board */}
      <div className="inline-block rounded-xl overflow-hidden shadow-lg border-4 border-amber-900">
        {ranks.map(rank => (
          <div key={rank} className="flex">
            {/* Rank label */}
            <div className="w-5 flex items-center justify-center text-[10px] font-bold text-amber-900 bg-amber-100 shrink-0">
              {rank}
            </div>
            {files.map(file => {
              const sq = file + rank
              const piece = getPiece(file, rank)
              const isDark = squareColor(file, rank) === 'dark'
              const isSelected = selected === sq
              const isTarget = legalTargets.includes(sq)
              const isKingInCheck = kingSquare === sq

              let bg = isDark ? 'bg-amber-700' : 'bg-amber-100'
              if (isSelected) bg = 'bg-yellow-300'
              else if (isKingInCheck) bg = 'bg-red-400'

              return (
                <button
                  key={sq}
                  onClick={() => handleSquareClick(sq)}
                  className={`relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center
                    transition-colors cursor-pointer focus:outline-none
                    ${bg}
                    ${!disabled && 'hover:brightness-90'}`}
                >
                  {/* Legal move dot or capture ring */}
                  {isTarget && !piece && (
                    <div className="w-3 h-3 rounded-full bg-black/25 pointer-events-none" />
                  )}
                  {isTarget && piece && (
                    <div className="absolute inset-0 ring-4 ring-inset ring-black/25 rounded-sm pointer-events-none" />
                  )}

                  {/* Piece */}
                  {piece && (
                    <span className={`text-2xl sm:text-3xl leading-none pointer-events-none
                      ${piece.color === 'w' ? 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]' : 'text-gray-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.4)]'}`}
                    >
                      {PIECE_GLYPHS[piece.color + piece.type.toUpperCase()]}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}

        {/* File labels */}
        <div className="flex bg-amber-100">
          <div className="w-5 shrink-0" />
          {files.map(f => (
            <div key={f} className="w-10 sm:w-12 text-center text-[10px] font-bold text-amber-900 py-0.5">
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
