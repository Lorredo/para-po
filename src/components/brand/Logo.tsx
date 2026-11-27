type LogoProps = {
  size?: number
  className?: string
}

/** Bell-headed map pin on a jeepney-yellow tile. Mirrors public/favicon.svg. */
export function Logo({ size = 40, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Para Po logo"
    >
      <rect width="64" height="64" rx="14" fill="#FFB703" />
      <path
        d="M32 8c-9.9 0-18 8-18 17.8C14 39 32 56 32 56s18-17 18-30.2C50 16 41.9 8 32 8z"
        fill="#0B3C5D"
      />
      <path
        d="M32 15.2c-1 0-1.8.8-1.8 1.8v.6c-3.7.8-6.2 4-6.2 7.8v4.3l-2 2.5v1.2h20v-1.2l-2-2.5v-4.3c0-3.8-2.5-7-6.2-7.8V17c0-1-.8-1.8-1.8-1.8z"
        fill="#FFB703"
      />
      <circle cx="32" cy="35.6" r="2.2" fill="#FFB703" />
      <path
        d="M10.5 19.5q-4 6.5 0 13M53.5 19.5q4 6.5 0 13"
        stroke="#0B3C5D"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}
