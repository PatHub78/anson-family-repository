// Scrabble constants and pure logic functions

// Standard Scrabble letter distribution — 98 letters + 2 blanks = 100 total
export const LETTER_DISTRIBUTION: Record<string, number> = {
  A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1,
  K: 1, L: 4, M: 2, N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6,
  U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1, _: 2,
}

export const LETTER_VALUES: Record<string, number> = {
  A: 1, E: 1, I: 1, O: 1, U: 1, L: 1, N: 1, S: 1, T: 1, R: 1,
  D: 2, G: 2,
  B: 3, C: 3, M: 3, P: 3,
  F: 4, H: 4, V: 4, W: 4, Y: 4,
  K: 5,
  J: 8, X: 8,
  Q: 10, Z: 10,
  _: 0,
}

// Bonus squares keyed by "row,col"
export type Bonus = 'TW' | 'DW' | 'TL' | 'DL' | 'CENTER'

export const BONUS_SQUARES: Record<string, Bonus> = {
  // Triple Word
  '0,0': 'TW', '0,7': 'TW', '0,14': 'TW',
  '7,0': 'TW', '7,14': 'TW',
  '14,0': 'TW', '14,7': 'TW', '14,14': 'TW',
  // Double Word
  '1,1': 'DW', '2,2': 'DW', '3,3': 'DW', '4,4': 'DW',
  '1,13': 'DW', '2,12': 'DW', '3,11': 'DW', '4,10': 'DW',
  '10,4': 'DW', '11,3': 'DW', '12,2': 'DW', '13,1': 'DW',
  '10,10': 'DW', '11,11': 'DW', '12,12': 'DW', '13,13': 'DW',
  '7,7': 'CENTER',
  // Triple Letter
  '1,5': 'TL', '1,9': 'TL',
  '5,1': 'TL', '5,5': 'TL', '5,9': 'TL', '5,13': 'TL',
  '9,1': 'TL', '9,5': 'TL', '9,9': 'TL', '9,13': 'TL',
  '13,5': 'TL', '13,9': 'TL',
  // Double Letter
  '0,3': 'DL', '0,11': 'DL',
  '2,6': 'DL', '2,8': 'DL',
  '3,0': 'DL', '3,7': 'DL', '3,14': 'DL',
  '6,2': 'DL', '6,6': 'DL', '6,8': 'DL', '6,12': 'DL',
  '7,3': 'DL', '7,11': 'DL',
  '8,2': 'DL', '8,6': 'DL', '8,8': 'DL', '8,12': 'DL',
  '11,0': 'DL', '11,7': 'DL', '11,14': 'DL',
  '12,6': 'DL', '12,8': 'DL',
  '14,3': 'DL', '14,11': 'DL',
}

export const BONUS_COLORS: Record<Bonus, string> = {
  TW: '#d52e44',
  DW: '#f4a8a8',
  TL: '#3170c8',
  DL: '#a8d0f4',
  CENTER: '#f4a8a8',
}

export const BONUS_LABELS: Record<Bonus, string> = {
  TW: 'TW',
  DW: 'DW',
  TL: 'TL',
  DL: 'DL',
  CENTER: '★',
}

export type BoardCell = { letter: string; player_email: string } | null
export type Board = BoardCell[][]
export type PlacedTile = { row: number; col: number; letter: string; rackIdx: number }

export function createInitialBag(): string[] {
  const bag: string[] = []
  for (const [letter, count] of Object.entries(LETTER_DISTRIBUTION)) {
    for (let i = 0; i < count; i++) bag.push(letter)
  }
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[bag[i], bag[j]] = [bag[j], bag[i]]
  }
  return bag
}

export function createInitialBoard(): Board {
  return Array.from({ length: 15 }, () => Array.from({ length: 15 }, () => null as BoardCell))
}

export function drawTiles(bag: string[], n: number): { drawn: string[]; remaining: string[] } {
  const drawn = bag.slice(0, n)
  const remaining = bag.slice(n)
  return { drawn, remaining }
}

export function isBoardEmpty(board: Board): boolean {
  for (const row of board) for (const cell of row) if (cell !== null) return false
  return true
}

export type ValidationResult =
  | { valid: false; error: string }
  | { valid: true; score: number; words: string[] }

export function validateAndScore(
  board: Board,
  placed: PlacedTile[],
  isFirstMove: boolean,
): ValidationResult {
  if (placed.length === 0) return { valid: false, error: 'No tiles placed' }

  // Unique positions and on-board
  const seen = new Set<string>()
  for (const p of placed) {
    const key = `${p.row},${p.col}`
    if (seen.has(key)) return { valid: false, error: 'Two tiles on same square' }
    if (p.row < 0 || p.row > 14 || p.col < 0 || p.col > 14) return { valid: false, error: 'Off the board' }
    if (board[p.row][p.col] !== null) return { valid: false, error: 'Square already taken' }
    seen.add(key)
  }

  // Direction: all same row (horizontal) or all same col (vertical). Single tile = both.
  const rows = new Set(placed.map(p => p.row))
  const cols = new Set(placed.map(p => p.col))
  let direction: 'h' | 'v'
  if (placed.length === 1) direction = 'h' // arbitrary; we still check both cross words
  else if (rows.size === 1) direction = 'h'
  else if (cols.size === 1) direction = 'v'
  else return { valid: false, error: 'Tiles must be in a straight line' }

  // Build temp board with placed tiles
  const temp: Board = board.map(r => [...r])
  for (const p of placed) temp[p.row][p.col] = { letter: p.letter, player_email: '' }

  // Helper to check if a position has a placed tile this turn
  const isPlaced = (r: number, c: number) =>
    placed.some(p => p.row === r && p.col === c)

  // Find main word extent (extend through existing tiles)
  let startR = placed[0].row, startC = placed[0].col
  let endR = startR, endC = startC
  for (const p of placed) {
    if (p.row < startR) startR = p.row
    if (p.col < startC) startC = p.col
    if (p.row > endR) endR = p.row
    if (p.col > endC) endC = p.col
  }
  if (direction === 'h') {
    while (startC > 0 && temp[startR][startC - 1] !== null) startC--
    while (endC < 14 && temp[endR][endC + 1] !== null) endC++
  } else {
    while (startR > 0 && temp[startR - 1][startC] !== null) startR--
    while (endR < 14 && temp[endR + 1][endC] !== null) endR++
  }

  // Walk main word: ensure contiguous, capture cells
  type Cell = { row: number; col: number; letter: string; placedThisTurn: boolean }
  const mainCells: Cell[] = []
  if (direction === 'h') {
    for (let c = startC; c <= endC; c++) {
      const cell = temp[startR][c]
      if (cell === null) return { valid: false, error: 'Gap between tiles' }
      mainCells.push({ row: startR, col: c, letter: cell.letter, placedThisTurn: isPlaced(startR, c) })
    }
  } else {
    for (let r = startR; r <= endR; r++) {
      const cell = temp[r][startC]
      if (cell === null) return { valid: false, error: 'Gap between tiles' }
      mainCells.push({ row: r, col: startC, letter: cell.letter, placedThisTurn: isPlaced(r, startC) })
    }
  }

  // First move: must touch center
  if (isFirstMove) {
    const touchesCenter = mainCells.some(c => c.row === 7 && c.col === 7)
    if (!touchesCenter) return { valid: false, error: 'First word must cover the center star' }
  } else {
    // Subsequent moves: at least one placed tile adjacent to or extending an existing tile
    const extendsExisting = mainCells.some(c => !c.placedThisTurn)
    const adjacentToExisting = placed.some(p => {
      const ns = [[p.row - 1, p.col], [p.row + 1, p.col], [p.row, p.col - 1], [p.row, p.col + 1]]
      return ns.some(([r, c]) =>
        r >= 0 && r < 15 && c >= 0 && c < 15 && board[r][c] !== null,
      )
    })
    if (!extendsExisting && !adjacentToExisting) {
      return { valid: false, error: 'New word must connect to an existing tile' }
    }
  }

  // Collect all words formed (main + perpendicular crosses through placed tiles)
  type Word = { cells: Cell[] }
  const words: Word[] = []
  if (mainCells.length > 1) words.push({ cells: mainCells })

  for (const p of placed) {
    // Perpendicular direction
    if (direction === 'h') {
      // Look vertically through this column
      let sR = p.row, eR = p.row
      while (sR > 0 && temp[sR - 1][p.col] !== null) sR--
      while (eR < 14 && temp[eR + 1][p.col] !== null) eR++
      if (eR > sR) {
        const cs: Cell[] = []
        for (let r = sR; r <= eR; r++) {
          cs.push({ row: r, col: p.col, letter: temp[r][p.col]!.letter, placedThisTurn: isPlaced(r, p.col) })
        }
        words.push({ cells: cs })
      }
    } else {
      let sC = p.col, eC = p.col
      while (sC > 0 && temp[p.row][sC - 1] !== null) sC--
      while (eC < 14 && temp[p.row][eC + 1] !== null) eC++
      if (eC > sC) {
        const cs: Cell[] = []
        for (let c = sC; c <= eC; c++) {
          cs.push({ row: p.row, col: c, letter: temp[p.row][c]!.letter, placedThisTurn: isPlaced(p.row, c) })
        }
        words.push({ cells: cs })
      }
    }
  }

  if (words.length === 0) {
    // Single tile that didn't extend or cross anything
    return { valid: false, error: 'A word must be at least 2 letters' }
  }

  // Score each word
  let total = 0
  const wordStrings: string[] = []
  for (const word of words) {
    let wordScore = 0
    let mult = 1
    for (const c of word.cells) {
      let v = LETTER_VALUES[c.letter] ?? 0
      if (c.placedThisTurn) {
        const bonus = BONUS_SQUARES[`${c.row},${c.col}`]
        if (bonus === 'DL') v *= 2
        else if (bonus === 'TL') v *= 3
        else if (bonus === 'DW' || bonus === 'CENTER') mult *= 2
        else if (bonus === 'TW') mult *= 3
      }
      wordScore += v
    }
    wordScore *= mult
    total += wordScore
    wordStrings.push(word.cells.map(c => c.letter).join(''))
  }

  // Bingo: used all 7 tiles
  if (placed.length === 7) total += 50

  return { valid: true, score: total, words: wordStrings }
}
