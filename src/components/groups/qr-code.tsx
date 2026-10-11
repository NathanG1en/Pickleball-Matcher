"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QRCodeDisplay({
  url,
  size = 200,
  className = "",
}: {
  url: string;
  size?: number;
  className?: string;
}) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(url, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then((svgString) => {
        if (!cancelled) {
          setSvg(svgString);
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center rounded-2xl border-2 border-black bg-neutral-100 p-4 text-center text-xs font-bold text-neutral-600 ${className}`}
      >
        Unable to load QR Code
      </div>
    );
  }

  if (!svg) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center rounded-2xl border-2 border-black bg-neutral-100 animate-pulse ${className}`}
        aria-label="Loading QR code"
      >
        <span className="text-xs font-black uppercase tracking-wider text-neutral-400">Loading…</span>
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={`relative p-2 bg-white rounded-2xl border-[3px] border-black shadow-[4px_4px_0px_0px_#000] flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:rounded-lg ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
      role="img"
      aria-label="QR Code link to join group"
    />
  );
}

