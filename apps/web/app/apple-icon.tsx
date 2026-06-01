import { ImageResponse } from "next/og";

// Apple touch icon (iOS/Android home-screen). Full-bleed brand gradient (no
// transparency, so it looks right when the OS masks corners) with the dark notch.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";
// Render at request time (not prerendered at build) so @vercel/og doesn't run
// during `next build` — it crashes on Windows but works on Railway's Linux.
export const dynamic = "force-dynamic";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg,#C4571C 0%,#F8CF40 35%,#0D5A84 70%,#B1D4E0 100%)",
        }}
      >
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: 16,
            background: "#0A3A56",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
