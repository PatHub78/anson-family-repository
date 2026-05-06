import { ImageResponse } from 'next/og'

export const size        = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
          borderRadius: '20%',
        }}
      >
        <span
          style={{
            color: '#ffffff',
            fontSize: 320,
            fontWeight: 900,
            fontFamily: 'serif',
            lineHeight: 1,
          }}
        >
          A
        </span>
      </div>
    ),
    { ...size }
  )
}
