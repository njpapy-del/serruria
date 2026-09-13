import { ImageResponse } from "next/og";
import { siteConfig } from "@/data/site-config";

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
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(180deg, #050810, #0a0f1c)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 700, color: "#ffb020", letterSpacing: 2 }}>
          {siteConfig.brand.name}
        </div>
        <div style={{ fontSize: 56, fontWeight: 800, marginTop: 24, maxWidth: 900 }}>
          {siteConfig.brand.positioning}
        </div>
        <div style={{ fontSize: 28, marginTop: 24, color: "#c3cbdb", maxWidth: 800 }}>
          {siteConfig.hero.subtitle}
        </div>
      </div>
    ),
    size
  );
}
