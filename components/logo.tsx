export function LogoMark({
  size = 32,
  gradientId = "sf-logo-gradient",
  className,
}: {
  size?: number;
  gradientId?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="10"
          y1="48"
          x2="54"
          y2="16"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#0077FF" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <g transform="rotate(-22 32 32)">
        <rect x="21.5" y="20.5" width="33" height="11" rx="5.5" fill="#F5F7FF" />
        <rect x="12.5" y="33.5" width="33" height="11" rx="5.5" fill={`url(#${gradientId})`} />
      </g>
    </svg>
  );
}

export function LogoLockup({
  markSize = 40,
  gradientId = "sf-logo-lockup",
  className = "",
}: {
  markSize?: number;
  gradientId?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <LogoMark
        size={markSize}
        gradientId={gradientId}
        className="drop-shadow-[0_0_14px_rgba(0,119,255,0.3)]"
      />
      <div className="leading-none">
        <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-muted">Zeroth</p>
        <p className="mt-1.5 text-base font-semibold tracking-tight text-white">
          Stock<span className="logo-flow">Flow</span>
          <span className="ml-0.5 align-super text-[8px] font-medium text-muted">™</span>
        </p>
      </div>
    </div>
  );
}
