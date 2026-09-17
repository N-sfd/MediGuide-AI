import { ImageResponse } from "next/og";

export const alt = "MediGuide — Health information. Clearer. Confident. Connected.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          background: "linear-gradient(135deg, #f4f7f3 0%, #dcefe4 60%, #eef1ec 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <svg width="96" height="115" viewBox="0 0 40 48" fill="none">
            <path
              d="M6 4h20l8 8v30a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z"
              fill="#f7faf8"
              stroke="#156b5a"
              strokeWidth="2.5"
            />
            <path d="M26 4v8h8" fill="none" stroke="#156b5a" strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M26 4l8 8" fill="#dcefe4" stroke="#156b5a" strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M10 34 L16 28 L24 24 L30 16" fill="none" stroke="#17221f" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="10" cy="34" r="2.4" fill="#156b5a" />
            <circle cx="16" cy="28" r="2.4" fill="#156b5a" />
            <circle cx="24" cy="24" r="2.4" fill="#156b5a" />
            <circle cx="30" cy="16" r="3.2" fill="#d87968" />
            <path d="M28 40c6-1 10-5 11-10-5 1-9 5-11 10z" fill="#9ec9b4" />
          </svg>
          <div
            style={{
              fontSize: 108,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#0e3d33",
            }}
          >
            MediGuide
          </div>
        </div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: "0.02em",
            color: "#5c6a63",
          }}
        >
          HEALTH INFORMATION. CLEARER. CONFIDENT. CONNECTED.
        </div>
      </div>
    ),
    { ...size },
  );
}
