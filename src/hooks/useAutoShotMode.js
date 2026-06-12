import { useCallback, useEffect, useRef, useState } from "react";

const CAMERA_CONSTRAINTS = {
  audio: false,
  video: {
    facingMode: "environment",
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 60, min: 24 },
  },
};

function getCameraErrorMessage(error) {
  if (!error) return "Camera unavailable.";
  if (error.name === "NotAllowedError") return "Camera permission was denied. Enable camera access to use Auto Mode.";
  if (error.name === "NotFoundError") return "No camera was found on this device.";
  if (error.name === "NotReadableError") return "The camera is already in use by another app.";
  return error.message || "Unable to start camera.";
}

function drawRoundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

export function useAutoShotMode() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const fpsSampleRef = useRef({ lastTime: 0, frames: 0 });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [fps, setFps] = useState(0);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });

  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setStatus("idle");
    setFps(0);
  }, []);

  const drawOverlay = useCallback((timestamp) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const width = video.videoWidth || canvas.clientWidth || 640;
    const height = video.videoHeight || canvas.clientHeight || 360;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      setVideoSize({ width, height });
    }

    const context = canvas.getContext("2d");
    if (context) {
      context.clearRect(0, 0, width, height);
      context.lineWidth = Math.max(2, width * 0.004);
      context.strokeStyle = "rgba(255, 159, 28, 0.95)";
      context.fillStyle = "rgba(255, 159, 28, 0.16)";

      const guideWidth = width * 0.38;
      const guideHeight = height * 0.28;
      const guideX = (width - guideWidth) / 2;
      const guideY = height * 0.12;
      drawRoundedRect(context, guideX, guideY, guideWidth, guideHeight, 18);
      context.fill();
      context.stroke();

      context.fillStyle = "rgba(255, 255, 255, 0.9)";
      context.font = `${Math.max(14, width * 0.026)}px system-ui, sans-serif`;
      context.fillText("Phase 0 camera overlay", 18, 32);
      context.fillText("Ball + rim detection coming next", 18, 58);
    }

    const sample = fpsSampleRef.current;
    sample.frames += 1;
    if (!sample.lastTime) sample.lastTime = timestamp;
    const elapsed = timestamp - sample.lastTime;
    if (elapsed >= 1000) {
      setFps(Math.round((sample.frames * 1000) / elapsed));
      sample.frames = 0;
      sample.lastTime = timestamp;
    }

    animationFrameRef.current = requestAnimationFrame(drawOverlay);
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not support camera access.");
      setStatus("error");
      return;
    }

    setStatus("requesting");
    setError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setStatus("streaming");
      animationFrameRef.current = requestAnimationFrame(drawOverlay);
    } catch (cameraError) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setError(getCameraErrorMessage(cameraError));
      setStatus("error");
    }
  }, [drawOverlay, stopCamera]);

  useEffect(() => stopCamera, [stopCamera]);

  return {
    videoRef,
    canvasRef,
    status,
    error,
    fps,
    videoSize,
    startCamera,
    stopCamera,
    isStreaming: status === "streaming",
  };
}
