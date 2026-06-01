/**
 * Spark logo mark — rounded square with the brand-color conic gradient
 * (orange → yellow → blue → light-blue), per the requirements spec.
 */
export function SparkLogo({ size = 30 }: { size?: number }) {
  const inset = Math.round(size * 0.23);
  return (
    <span
      role="img"
      aria-label="Spark"
      style={{
        position: "relative",
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        background:
          "conic-gradient(from 210deg,#C4571C,#F8CF40,#0D5A84,#B1D4E0,#C4571C)",
        boxShadow:
          "0 0 0 1px rgba(255,255,255,.14),0 6px 18px rgba(196,87,28,.35)",
        flex: "none",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset,
          background: "#0A3A56",
          borderRadius: Math.round(size * 0.13),
        }}
      />
    </span>
  );
}
