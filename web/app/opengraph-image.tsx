import { ImageResponse } from "next/og";

export const alt = "Reelmate — Your Film DNA";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  const holes = [0, 72, 144, 216, 288].map((a) => {
    const r = (a * Math.PI) / 180;
    return { x: 110 + Math.sin(r) * 52, y: 110 - Math.cos(r) * 52 };
  });
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: "0 90px",
          background: "radial-gradient(900px 500px at 20% 0%, #3a2a0b 0%, #0b0a0e 70%)",
          color: "#f4efe4",
          fontFamily: "sans-serif",
        }}
      >
        <svg width="220" height="220" viewBox="0 0 220 220">
          <circle cx="110" cy="110" r="100" fill="none" stroke="#f2b134" strokeWidth="10" />
          {holes.map((h, i) => (
            <circle key={i} cx={h.x} cy={h.y} r="17" fill="#f2b134" />
          ))}
          <circle cx="110" cy="110" r="12" fill="#f2b134" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 60 }}>
          <div style={{ fontSize: 150, fontWeight: 800, letterSpacing: 4, lineHeight: 1 }}>REELMATE</div>
          <div style={{ fontSize: 44, color: "#f2b134", marginTop: 18 }}>Tu ADN de cine · Your Film DNA</div>
          <div style={{ fontSize: 28, color: "#a9a2b3", marginTop: 22 }}>No guardamos tus datos en ningún servidor</div>
        </div>
      </div>
    ),
    size,
  );
}
