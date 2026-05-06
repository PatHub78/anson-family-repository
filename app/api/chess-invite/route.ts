import { NextRequest, NextResponse } from 'next/server'

const RESEND_API_KEY = process.env.RESEND_API_KEY!
const FROM_EMAIL     = 'chess@ansonfamily.site'
const APP_URL        = 'https://www.ansonfamily.site'

export async function POST(req: NextRequest) {
  try {
    const { challengerName, challengerEmail, opponentEmail, opponentName, challengerColor } =
      await req.json()

    const opponentColor  = challengerColor === 'w' ? 'Black' : 'White'
    const theirPieces    = opponentColor

    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <div style="background: linear-gradient(135deg, #312e2b, #4a3728); border-radius: 20px; padding: 32px; text-align: center; margin-bottom: 24px;">
          <div style="font-size: 52px; margin-bottom: 12px;">♟</div>
          <h1 style="color: #fff; font-size: 24px; font-weight: 900; margin: 0 0 8px;">
            ${challengerName} has challenged you to chess!
          </h1>
          <p style="color: rgba(255,255,255,0.65); font-size: 14px; margin: 0;">
            You're playing as <strong style="color: #BACA2B;">${theirPieces}</strong>.
            White moves first — you have <strong style="color: #BACA2B;">2 weeks</strong> to make each move.
          </p>
        </div>

        <div style="background: #f9fafb; border-radius: 16px; padding: 20px; margin-bottom: 24px; border: 1px solid #e5e7eb; text-align: center;">
          <div style="display: inline-flex; gap: 16px; align-items: center;">
            <div>
              <div style="font-size: 28px;">⬜</div>
              <div style="font-size: 13px; font-weight: 700; color: #374151; margin-top: 4px;">
                ${challengerColor === 'w' ? challengerName : opponentName}
              </div>
              <div style="font-size: 11px; color: #9ca3af;">White</div>
            </div>
            <div style="font-size: 22px; color: #9ca3af; font-weight: 900;">vs</div>
            <div>
              <div style="font-size: 28px;">⬛</div>
              <div style="font-size: 13px; font-weight: 700; color: #374151; margin-top: 4px;">
                ${challengerColor === 'b' ? challengerName : opponentName}
              </div>
              <div style="font-size: 11px; color: #9ca3af;">Black</div>
            </div>
          </div>
        </div>

        <div style="text-align: center;">
          <a href="${APP_URL}/chess"
            style="display: inline-block; background: #769656; color: #fff; font-weight: 700; font-size: 15px; padding: 14px 36px; border-radius: 14px; text-decoration: none;">
            Open Chess ♟
          </a>
        </div>

        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
          Anson Family App · ansonfamily.site
        </p>
      </div>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: opponentEmail,
        subject: `${challengerName} challenged you to chess! ♟`,
        html,
      }),
    })

    if (!res.ok) throw new Error(await res.text())
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('chess-invite error:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
