export default function IndianFlag({ size = 28, className = '', rounded = true }) {
  const width = size
  const height = Math.round(size * 0.66) // 3:2 ratio

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 900 600"
      className={className}
      style={{
        borderRadius: rounded ? 4 : 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        display: 'inline-block',
        verticalAlign: 'middle',
        overflow: 'hidden'
      }}
    >
      {/* Top Saffron Band */}
      <rect width="900" height="200" fill="#FF9933" />
      {/* Middle White Band */}
      <rect y="200" width="900" height="200" fill="#FFFFFF" />
      {/* Bottom India Green Band */}
      <rect y="400" width="900" height="200" fill="#138808" />

      {/* Ashoka Chakra */}
      <g transform="translate(450, 300)" stroke="#000080">
        {/* Outer Wheel Rim */}
        <circle r="85" fill="none" strokeWidth="8" />
        <circle r="18" fill="#000080" />
        {/* 24 Spokes */}
        {Array.from({ length: 24 }).map((_, i) => {
          const angle = (i * 360) / 24
          const rad = (angle * Math.PI) / 180
          const x2 = Math.cos(rad) * 85
          const y2 = Math.sin(rad) * 85
          return (
            <line
              key={i}
              x1="0"
              y1="0"
              x2={x2}
              y2={y2}
              strokeWidth="4"
              stroke="#000080"
            />
          )
        })}
        {/* 24 Outer Dots/Specks */}
        {Array.from({ length: 24 }).map((_, i) => {
          const angle = (i * 360) / 24 + 7.5
          const rad = (angle * Math.PI) / 180
          const cx = Math.cos(rad) * 82
          const cy = Math.sin(rad) * 82
          return (
            <circle
              key={`dot-${i}`}
              cx={cx}
              cy={cy}
              r="2.5"
              fill="#000080"
              stroke="none"
            />
          )
        })}
      </g>
    </svg>
  )
}

export function IndianFlagEmblem({ size = 36, className = '' }) {
  // A circular / squircle tricolor badge with Ashoka Chakra
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        border: '2px solid rgba(255,255,255,0.4)',
        background: '#ffffff',
        flexShrink: 0
      }}
    >
      <IndianFlag size={size * 1.5} rounded={false} />
    </div>
  )
}
