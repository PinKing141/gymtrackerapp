import { useEffect, useRef, useState } from "react";
import { ActionButton } from "../ui.jsx";
import { colors } from "../../theme.js";

// Full-screen camera barcode scanner. @zxing is lazy-loaded (dynamic import) so
// it only ships when the user actually opens the scanner, and works on iOS
// Safari — which lacks the native BarcodeDetector API. Falls back cleanly to
// manual entry when the camera is unavailable or permission is denied.
export function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const onDetectedRef = useRef(onDetected);
  const [status, setStatus] = useState("starting");
  const [error, setError] = useState("");

  useEffect(() => {
    onDetectedRef.current = onDetected;
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);

        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
        ]);

        const reader = new BrowserMultiFormatReader(hints);
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoRef.current,
          (result, _err, ctrl) => {
            if (cancelled || !result) return;
            ctrl.stop();
            onDetectedRef.current?.(result.getText());
          },
        );

        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setStatus("scanning");
      } catch (err) {
        if (cancelled) return;
        const name = err?.name || "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setError("Camera access was blocked. Allow it in your browser settings, or enter the barcode by hand.");
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setError("No camera available on this device. Enter the barcode by hand.");
        } else {
          setError("Couldn't start the camera. Enter the barcode by hand.");
        }
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      try {
        controlsRef.current?.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#000", display: "flex", flexDirection: "column" }}>
      <video ref={videoRef} playsInline muted autoPlay style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />

      {status === "scanning" && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "72%", maxWidth: 300, height: 150, border: "2px solid rgba(255,255,255,0.9)", borderRadius: 16, boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)" }} />
      )}

      <div style={{ position: "relative", marginTop: "auto", padding: "20px 20px calc(env(safe-area-inset-bottom, 0px) + 20px)", zIndex: 1 }}>
        {error ? (
          <div style={{ background: "rgba(10,10,15,0.92)", border: `1px solid ${colors.border}`, borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <p style={{ margin: 0, color: colors.textPrimary, fontSize: 13, lineHeight: 1.45 }}>{error}</p>
          </div>
        ) : (
          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.92)", fontSize: 13, fontWeight: 700, marginBottom: 12, textShadow: "0 1px 6px rgba(0,0,0,0.7)" }}>
            {status === "starting" ? "Starting camera…" : "Point the camera at a barcode"}
          </p>
        )}
        <ActionButton tone="secondary" onClick={onClose} style={{ background: "rgba(255,255,255,0.16)", color: "#fff", border: "none" }}>
          {error ? "Enter it manually" : "Cancel"}
        </ActionButton>
      </div>
    </div>
  );
}
