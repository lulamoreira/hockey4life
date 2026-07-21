// Placeholder do capacete Hockey4Life. Substitua o path por `capacete.svg` real
// quando o arquivo for anexado.
export function Capacete({ size = 34, color = "currentColor", className }: { size?: number; color?: string; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-hidden="true"
      className={className}
    >
      {/* Silhueta simplificada de capacete de hóquei — placeholder até o SVG oficial */}
      <path
        fill={color}
        d="M32 6c-11.6 0-22 8.4-22 22v9c0 2.8 2.2 5 5 5h6l2 6c.5 1.4 1.8 2.4 3.3 2.4h11.4c1.5 0 2.8-1 3.3-2.4l2-6h6c2.8 0 5-2.2 5-5v-9C54 14.4 43.6 6 32 6zm-14 26h-4v-4c0-1.6.3-3.2.7-4.7l3.3 1.9V32zm18 12h-8v-4h8v4zm14-12h-4v-6.8l3.3-1.9c.4 1.5.7 3.1.7 4.7v4z"
      />
      <path fill={color} d="M20 22h24v4H20z" opacity=".35" />
    </svg>
  );
}
