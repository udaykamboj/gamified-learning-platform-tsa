import React from 'react'

/**
 * StarLabLogo — inline SVG wordmark that inherits color via `currentColor`.
 * Pass className/style to control the color (e.g. text-white, text-gray-900).
 */
export function StarLabLogo({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      width="110"
      height="34"
      viewBox="0 0 133 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="Starlab"
      role="img"
    >
      {/* Orbital ring / swoosh */}
      <ellipse cx="22" cy="22" rx="18" ry="7" stroke="currentColor" strokeWidth="2" fill="none" transform="rotate(-20 22 22)" opacity="0.9"/>
      {/* Small dot top right of icon */}
      <circle cx="33" cy="8" r="2.2" fill="currentColor"/>
      {/* Small dot bottom left of icon */}
      <circle cx="7" cy="33" r="1.8" fill="currentColor"/>
      {/* 4-pointed star shape */}
      <path d="M22 6 C22 6 24 14 30 16 C24 18 22 26 22 26 C22 26 20 18 14 16 C20 14 22 6 22 6Z" fill="currentColor"/>

      {/* S */}
      <path d="M46 28 C43 28 41 26.5 41 24.5 C41 22.8 42.2 21.8 44 21.3 L47 20.5 C48.5 20.1 49 19.6 49 18.8 C49 17.8 48 17.2 46.5 17.2 C44.8 17.2 43.8 18 43.5 19.5 L41 19 C41.5 16.5 43.5 15 46.5 15 C49.5 15 51.5 16.5 51.5 18.8 C51.5 20.5 50.4 21.6 48.2 22.2 L45.5 22.9 C44.2 23.3 43.6 23.8 43.6 24.7 C43.6 25.7 44.6 26.3 46.2 26.3 C48 26.3 49.2 25.4 49.4 23.9 L51.9 24.4 C51.5 27 49.3 28 46 28Z" fill="currentColor"/>
      {/* t */}
      <path d="M54 28 L54 17.3 L52 17.3 L52 15.2 L54 15.2 L54 12 L56.5 12 L56.5 15.2 L59 15.2 L59 17.3 L56.5 17.3 L56.5 28 L54 28Z" fill="currentColor"/>
      {/* a */}
      <path d="M68 28 L68 26.8 C67.2 27.7 66 28.2 64.5 28.2 C62.2 28.2 60.5 26.8 60.5 24.8 C60.5 22.8 62.2 21.5 65 21.5 L68 21.5 L68 20.8 C68 19.5 67.2 18.8 65.8 18.8 C64.6 18.8 63.8 19.4 63.5 20.5 L61.2 20 C61.7 17.9 63.4 17 65.9 17 C68.8 17 70.5 18.4 70.5 20.8 L70.5 28 L68 28Z M68 23.2 L65.5 23.2 C64.2 23.2 63.2 23.8 63.2 24.9 C63.2 25.9 64 26.5 65.2 26.5 C66.9 26.5 68 25.5 68 24 L68 23.2Z" fill="currentColor"/>
      {/* r */}
      <path d="M73 28 L73 17.2 L75.4 17.2 L75.4 19 C76 17.8 77.2 17 78.8 17 C79.2 17 79.6 17.1 79.9 17.2 L79.9 19.6 C79.5 19.5 79 19.4 78.5 19.4 C76.7 19.4 75.4 20.6 75.4 22.4 L75.4 28 L73 28Z" fill="currentColor"/>
      {/* l */}
      <path d="M82 28 L82 12 L84.5 12 L84.5 28 L82 28Z" fill="currentColor"/>
      {/* a */}
      <path d="M95 28 L95 26.8 C94.2 27.7 93 28.2 91.5 28.2 C89.2 28.2 87.5 26.8 87.5 24.8 C87.5 22.8 89.2 21.5 92 21.5 L95 21.5 L95 20.8 C95 19.5 94.2 18.8 92.8 18.8 C91.6 18.8 90.8 19.4 90.5 20.5 L88.2 20 C88.7 17.9 90.4 17 92.9 17 C95.8 17 97.5 18.4 97.5 20.8 L97.5 28 L95 28Z M95 23.2 L92.5 23.2 C91.2 23.2 90.2 23.8 90.2 24.9 C90.2 25.9 91 26.5 92.2 26.5 C93.9 26.5 95 25.5 95 24 L95 23.2Z" fill="currentColor"/>
      {/* b */}
      <path d="M100 28 L100 12 L102.5 12 L102.5 18.5 C103.3 17.5 104.5 17 106 17 C108.8 17 110.8 19 110.8 22.5 C110.8 26 108.8 28.2 106 28.2 C104.4 28.2 103.2 27.6 102.4 26.5 L102.4 28 L100 28Z M102.4 22.5 C102.4 24.5 103.6 26 105.5 26 C107.3 26 108.3 24.6 108.3 22.5 C108.3 20.4 107.3 19 105.5 19 C103.6 19 102.4 20.5 102.4 22.5Z" fill="currentColor"/>
    </svg>
  )
}
