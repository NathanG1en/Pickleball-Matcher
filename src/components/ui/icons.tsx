import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement> & {
  className?: string;
};

const defaultProps = {
  "aria-hidden": true,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function PencilIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg {...defaultProps} className={className} {...props}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

export function ZapIcon({ className, width, height, ...props }: IconProps) {
  const fallbackClassName = !width && !height && !className ? "h-4 w-4" : className;
  return (
    <svg
      {...defaultProps}
      width={width}
      height={height}
      className={fallbackClassName}
      {...props}
    >
      <path d="M4 14L14 3V10H20L10 21V14H4Z" />
    </svg>
  );
}

export function TrophyIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg {...defaultProps} className={className} {...props}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.45 1-1 1H8c-.55 0-1 .45-1 1v1c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-1c0-.55-.45-1-1-1h-1c-.55 0-1-.45-1-1v-2.34" />
      <path d="M6 4h12a2 2 0 0 1 2 2v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6V6a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

export function LockIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg {...defaultProps} className={className} {...props}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function GlobeIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg {...defaultProps} className={className} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

export function SearchIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg {...defaultProps} className={className} {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function UserPlusIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg {...defaultProps} className={className} {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" x2="19" y1="8" y2="14" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </svg>
  );
}

export function UserIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg {...defaultProps} className={className} {...props}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function UsersIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg {...defaultProps} className={className} {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function HandshakeIcon({ className, width, height, ...props }: IconProps) {
  const fallbackClassName = !width && !height && !className ? "h-4 w-4" : className;
  return (
    <svg
      {...defaultProps}
      width={width}
      height={height}
      className={fallbackClassName}
      {...props}
    >
      <path
        fill="currentColor"
        stroke="none"
        d="M11.87505 20.5004c0.08335 0 0.1792 -0.02085 0.2875 -0.0625 0.10835 -0.0417 0.19585 -0.09585 0.2625 -0.1625l8.425 -8.45c0.2167 -0.2167 0.3792 -0.4625 0.4875 -0.7375 0.10835 -0.275 0.1625 -0.5542 0.1625 -0.8375 0 -0.28335 -0.05415 -0.5667 -0.1625 -0.85 -0.1083 -0.28335 -0.2708 -0.53335 -0.4875 -0.75l-4.5 -4.50001c-0.21665 -0.216665 -0.46665 -0.379165 -0.75 -0.4875 -0.2833 -0.108335 -0.56665 -0.1625 -0.85 -0.1625 -0.2833 0 -0.5625 0.054165 -0.8375 0.1625 -0.275 0.108335 -0.5208 0.270835 -0.7375 0.4875l-0.45 0.45 2.025 2.05001c0.2167 0.2333 0.40835 0.50415 0.575 0.8125 0.1667 0.3083 0.25 0.6458 0.25 1.0125 0 0.6333 -0.2458 1.19165 -0.7375 1.675 -0.49165 0.4833 -1.05415 0.725 -1.6875 0.725 -0.41665 0 -0.7625 -0.0625 -1.0375 -0.1875 -0.275 -0.125 -0.52915 -0.3042 -0.7625 -0.5375l-1.825 -1.825 -4.525 4.525c-0.08332 0.0833 -0.14165 0.1708 -0.174985 0.2625 -0.033335 0.09165 -0.05 0.1875 -0.05 0.2875 0 0.21665 0.070835 0.3958 0.2125 0.5375 0.141685 0.14165 0.320835 0.2125 0.537485 0.2125 0.1 0 0.19585 -0.025 0.2875 -0.075 0.0917 -0.05 0.17085 -0.10835 0.2375 -0.175l2.925 -2.925c0.15 -0.15 0.325 -0.225 0.525 -0.225s0.375 0.075 0.525 0.225c0.15 0.15 0.225 0.325 0.225 0.525s-0.075 0.375 -0.225 0.525l-2.9 2.9c-0.0833 0.0833 -0.14165 0.175 -0.175 0.275 -0.0333 0.1 -0.05 0.2 -0.05 0.3 0 0.2 0.075 0.375 0.225 0.525 0.15 0.15 0.325 0.225 0.525 0.225 0.1 0 0.19585 -0.02085 0.2875 -0.0625 0.0917 -0.0417 0.17085 -0.09585 0.2375 -0.1625l2.925 -2.925c0.15 -0.15 0.325 -0.225 0.525 -0.225s0.375 0.075 0.525 0.225c0.15 0.15 0.225 0.325 0.225 0.525s-0.075 0.375 -0.225 0.525l-2.9 2.9c-0.06665 0.06665 -0.1208 0.15415 -0.1625 0.2625 -0.04165 0.1083 -0.0625 0.2125 -0.0625 0.3125 0 0.2 0.075 0.375 0.225 0.525 0.15 0.15 0.325 0.225 0.525 0.225 0.1 0 0.1917 -0.0167 0.275 -0.05 0.08335 -0.03335 0.1667 -0.0917 0.25 -0.175l2.925 -2.925c0.15 -0.15 0.325 -0.225 0.525 -0.225s0.375 0.075 0.525 0.225c0.15 0.15 0.225 0.325 0.225 0.525s-0.075 0.375 -0.225 0.525l-2.925 2.925c-0.0833 0.0833 -0.14165 0.175 -0.175 0.275 -0.0333 0.1 -0.05 0.19165 -0.05 0.275 0 0.2333 0.0667 0.41665 0.2 0.55 0.13335 0.1333 0.3167 0.2 0.55 0.2Zm0 1.5c-0.55 0 -1.04165 -0.2042 -1.475 -0.6125 -0.4333 -0.40835 -0.69165 -0.9125 -0.775 -1.5125 -0.56665 -0.08335 -1.04165 -0.3167 -1.425 -0.7 -0.3833 -0.38335 -0.61665 -0.85835 -0.7 -1.425 -0.56665 -0.08335 -1.0375 -0.32085 -1.4125 -0.7125 -0.375 -0.3917 -0.60415 -0.8625 -0.6875 -1.4125 -0.61665 -0.08335 -1.124985 -0.33335 -1.524985 -0.75 -0.4 -0.4167 -0.6 -0.9167 -0.6 -1.5 0 -0.28335 0.054165 -0.5667 0.1625 -0.85 0.108335 -0.28335 0.270835 -0.53335 0.4875 -0.75l4.549985 -4.55c0.28335 -0.28335 0.63335 -0.425 1.05 -0.425 0.4167 0 0.7667 0.14165 1.05 0.425l1.7 1.7c0.13335 0.1333 0.2792 0.2375 0.4375 0.3125 0.15835 0.075 0.3125 0.1125 0.4625 0.1125 0.2167 0 0.42085 -0.09585 0.6125 -0.2875 0.1917 -0.1917 0.2875 -0.39585 0.2875 -0.6125 0 -0.1 -0.02915 -0.2125 -0.0875 -0.3375 -0.0583 -0.125 -0.15415 -0.2542 -0.2875 -0.3875l-3.575 -3.57501c-0.21665 -0.216665 -0.46665 -0.379165 -0.75 -0.4875 -0.2833 -0.108335 -0.56665 -0.1625 -0.85 -0.1625 -0.2833 0 -0.5625 0.054165 -0.8375 0.1625 -0.275 0.108335 -0.5208 0.270835 -0.7375 0.4875L3.150065 7.9504c-0.333335 0.3333 -0.5375 0.7375 -0.6125 1.2125 -0.075 0.475 -0.020835 0.92915 0.1625 1.3625 0.083335 0.1833 0.083335 0.3708 0 0.5625 -0.083335 0.19165 -0.216665 0.32915 -0.4 0.4125 -0.183335 0.0833 -0.375 0.0833 -0.575 0 -0.2 -0.08335 -0.341665 -0.2167 -0.425 -0.4 -0.283335 -0.75 -0.366665 -1.49585 -0.25 -2.2375 0.116665 -0.7417 0.466665 -1.4042 1.05 -1.9875l3.774985 -3.77501c0.3667 -0.366665 0.78335 -0.6375 1.25 -0.8125 0.4667 -0.175 0.9417 -0.2625 1.425 -0.2625 0.48335 0 0.9542 0.0875 1.4125 0.2625 0.45835 0.175 0.87085 0.445835 1.2375 0.8125l0.45 0.45 0.45 -0.45c0.3667 -0.366665 0.78335 -0.6375 1.25 -0.8125 0.4667 -0.175 0.9417 -0.2625 1.425 -0.2625 0.48335 0 0.9542 0.0875 1.4125 0.2625 0.45835 0.175 0.87085 0.445835 1.2375 0.8125l4.475 4.47501c0.3667 0.36665 0.6417 0.7833 0.825 1.25 0.18335 0.46665 0.275 0.94165 0.275 1.425 0 0.4833 -0.09165 0.95415 -0.275 1.4125 -0.1833 0.4583 -0.4583 0.8708 -0.825 1.2375l-8.425 8.425c-0.21665 0.21665 -0.4625 0.3833 -0.7375 0.5 -0.275 0.11665 -0.5625 0.175 -0.8625 0.175Z"
      />
    </svg>
  );
}

export function SmartphoneIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg {...defaultProps} className={className} {...props}>
      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </svg>
  );
}

export function AlertTriangleIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg {...defaultProps} className={className} {...props}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" x2="12" y1="9" y2="13" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  );
}

export function InfoIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg {...defaultProps} className={className} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

export function TargetIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg {...defaultProps} className={className} {...props}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

export function ShuffleIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg {...defaultProps} className={className} {...props}>
      <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.6-8.6c.8-1.1 2-1.7 3.3-1.7H22" />
      <path d="m18 2 4 4-4 4" />
      <path d="M2 6h1.4c1.3 0 2.5.6 3.3 1.7l6.6 8.6c.8 1.1 2 1.7 3.3 1.7H22" />
      <path d="m18 14 4 4-4 4" />
    </svg>
  );
}

export function ArrowDownToLineIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg {...defaultProps} className={className} {...props}>
      <path d="M12 17V3" />
      <path d="m6 11 6 6 6-6" />
      <path d="M19 21H5" />
    </svg>
  );
}

export function XIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg {...defaultProps} className={className} {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function CheckIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg {...defaultProps} className={className} {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function CopyIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg {...defaultProps} className={className} {...props}>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

export function ChevronDownIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg {...defaultProps} className={className} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}


