import { useEffect, useRef, useState, type CSSProperties } from "react";

/* Traced from the registered source bundle:
   https://threeui.com/source-code/ashen-press.json
   src/shaders/ashen-press/AshenPress.tsx
   SHA-256 36b365f7a69223f1c3347bfcb3f2d1aa1ab20d30f2c31e5efb248e62ab4ddc90

   One line differs from the registered file, and only that line: the authored
   `import ashenPressSource from "./sources/ashen-press.html?raw"` is a Vite
   asset import that has no Turbopack equivalent. The same byte-exact document
   is served from public/shaders/ashen-press/sources/ashen-press.html
   (SHA-256 5fe2554e578acac5d55cb466a9564440e7767e38797981f8e829dfd2de0bc90f)
   and loaded through iframe src instead of srcDoc. The sandbox is unchanged —
   `allow-scripts` with no `allow-same-origin`, so the document keeps the opaque
   origin it had under srcDoc and still cannot reach this page. */

export type AshenPressProps = {
  className?: string;
  style?: CSSProperties;
};

const ASHEN_PRESS_SOURCE = "/shaders/ashen-press/sources/ashen-press.html";

export function AshenPress({ className = "", style }: AshenPressProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [documentVisible, setDocumentVisible] = useState(() => (
    typeof document === "undefined" || !document.hidden
  ));
  const [hostVisible, setHostVisible] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      setHostVisible(entry?.isIntersecting ?? true);
    }, { rootMargin: "80px" });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const update = () => setDocumentVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const mounted = hostVisible && documentVisible;

  useEffect(() => {
    setReady(false);
  }, [mounted]);

  return (
    <div
      ref={hostRef}
      className={`threeui-background ashen-press${className ? ` ${className}` : ""}`}
      role="group"
      aria-label="Interactive Ashen Press art book shelf"
      data-state={!mounted ? "paused" : ready ? "ready" : "loading"}
      style={{
        position: "relative",
        overflow: "hidden",
        background: "#c6ae8e",
        pointerEvents: "auto",
        ...style,
      }}
    >
      {mounted ? (
        <iframe
          title="Ashen Press — The Art Book Shelf"
          src={ASHEN_PRESS_SOURCE}
          sandbox="allow-scripts"
          loading="eager"
          onLoad={() => setReady(true)}
          style={{
            position: "absolute",
            inset: 0,
            display: "block",
            width: "100%",
            height: "100%",
            border: 0,
            background: "#c6ae8e",
            opacity: ready ? 1 : 0,
            pointerEvents: ready ? "auto" : "none",
            transition: "opacity 240ms ease-out",
          }}
        />
      ) : null}
    </div>
  );
}
