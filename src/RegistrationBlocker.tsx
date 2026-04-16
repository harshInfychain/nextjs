import { useEffect, useRef, useState, type FormEvent } from 'react';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

interface AuthResponse {
  success: boolean;
  message: string;
}

// ⚠️ CHANGE THIS URL depending on how you are testing!
// PC Testing: "http://localhost:5000"
// Phone Testing (via Ngrok): "https://YOUR-NGROK-LINK.ngrok-free.app"
const API_URL = "http://localhost:5000"; 

export default function RegistrationBlocker() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [detector, setDetector] = useState<FaceDetector | null>(null);
  const [email, setEmail] = useState<string>('');
  const [message, setMessage] = useState<string>('Initializing Google MediaPipe...');
  const [mode, setMode] = useState<'register' | 'unlock'>('register');

  // 1. Initialize Google MediaPipe
  useEffect(() => {
    const initializeAI = async () => {
      console.log("[Init] Starting MediaPipe initialization...");
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        const faceDetector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
            delegate: "GPU"
          },
          runningMode: "VIDEO"
        });

        setDetector(faceDetector);
        setMessage('MediaPipe Active. Please face the camera.');
        startCamera();
      } catch (error) {
        console.error("[Init] Error loading MediaPipe:", error);
        setMessage('Error loading MediaPipe. Check console.');
      }
    };

    initializeAI();
  }, []);

  // 2. Start the Webcam
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setMessage("Camera permission denied. Please allow camera access.");
    }
  };

  // 3. Scan and Capture using MediaPipe
  const handleFaceScan = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!detector || !videoRef.current || !canvasRef.current) return;

    const vWidth = videoRef.current.videoWidth;
    const vHeight = videoRef.current.videoHeight;
    const vReady = videoRef.current.readyState;

    // 🛑 Prevent scanning if the video hasn't loaded its dimensions yet
    if (vWidth === 0 || vHeight === 0 || vReady < 2) {
      setMessage('Camera is still warming up. Please wait a second and try again.');
      return;
    }

    setMessage('Analyzing biometrics...');

    const startTimeMs = performance.now();

    try {
      // Run the detector
      const detections = detector.detectForVideo(videoRef.current, startTimeMs);

      if (detections.detections.length === 0) {
        setMessage('No face detected. Please look directly at the camera.');
        return;
      }

      // Capture the current frame
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = vWidth;
      canvas.height = vHeight;
      ctx?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      const faceImageBase64 = canvas.toDataURL('image/jpeg', 0.9);
      const endpoint = mode === 'register' ? '/api/register' : '/api/unlock';
      
      console.log(`[API] Sending request to: ${API_URL}${endpoint}`);

      // Send to Backend
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, image: faceImageBase64 })
      });

      const result: AuthResponse = await response.json();
      setMessage(result.message);

    } catch (err) {
      console.error("[Scan/API] Error:", err);
      setMessage(`Server connection failed. Ensure your backend is running at ${API_URL}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#050505] rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.8)] border border-gray-900 p-8">

        <h2 className="text-2xl font-bold text-white mb-6 text-center tracking-wide uppercase">
          GrowthChain Security
        </h2>

        {/* Video Feed */}
        <div className="relative w-full aspect-video bg-black border-2 border-yellow-600/30 rounded-lg overflow-hidden mb-6">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform scale-x-[-1]" 
          />
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Form Controls */}
        <form onSubmit={handleFaceScan} className="space-y-6">
          <div className="flex gap-4 mb-4 bg-[#0a0a0a] p-1 rounded-lg border border-gray-800">
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 py-2 text-sm font-bold uppercase rounded transition-colors ${mode === 'register' ? 'bg-yellow-600 text-black' : 'text-gray-500'}`}
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => setMode('unlock')}
              className={`flex-1 py-2 text-sm font-bold uppercase rounded transition-colors ${mode === 'unlock' ? 'bg-yellow-600 text-black' : 'text-gray-500'}`}
            >
              Unlock
            </button>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-2">
              Account Email
            </label>
            <input
              type="email"
              required
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-gray-800 rounded-lg text-gray-200 focus:outline-none focus:border-yellow-600 transition-all placeholder-gray-700"
              placeholder="user@skytock.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={!detector}
            className="w-full py-3 px-4 bg-gradient-to-b from-[#222] to-[#111] text-gray-300 font-bold rounded-lg border border-gray-800 hover:text-yellow-500 hover:border-yellow-600/50 transition-all shadow-lg disabled:opacity-50"
          >
            {mode === 'register' ? 'Create Secure Profile' : 'Scan to Unlock'}
          </button>
        </form>

        <div className="mt-6 p-4 rounded-lg bg-[#0a0a0a] border border-gray-800/80 text-center">
          <p className={`text-sm font-medium ${message.includes('failed') || message.includes('Error') || message.includes('No face') ? 'text-red-500' : 'text-yellow-500'}`}>
            {message}
          </p>
        </div>

      </div>
    </div>
  );
}