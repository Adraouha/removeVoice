import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Download, Trash2, Volume2, AlertCircle } from 'lucide-react';
import { encodeAudioBufferToWav } from '../utils/audioDsp';

interface KaraokeRecorderProps {
  instrumentalBuffer: AudioBuffer | null;
  isPlaying: boolean;
  onStartInstrumentalPlayback: () => void;
  onStopInstrumentalPlayback: () => void;
  audioCtx: AudioContext | null;
}

export const KaraokeRecorder: React.FC<KaraokeRecorderProps> = ({
  instrumentalBuffer,
  isPlaying,
  onStartInstrumentalPlayback,
  onStopInstrumentalPlayback,
  audioCtx,
}) => {
  const [hasMicPermission, setHasMicPermission] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [vocalLevel, setVocalLevel] = useState<number>(0);
  const [pitchNote, setPitchNote] = useState<string>('--');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // Request mic access
  const handleEnableMic = async () => {
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      mediaStreamRef.current = stream;
      setHasMicPermission(true);

      if (audioCtx) {
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);

        const monitorGain = audioCtx.createGain();
        monitorGain.gain.value = 0; // muted by default to avoid feedback loops
        analyser.connect(monitorGain);
        monitorGain.connect(audioCtx.destination);

        analyserRef.current = analyser;
        monitorGainRef.current = monitorGain;

        // Run level & pitch loop
        startPitchAndLevelLoop(analyser);
      }
    } catch (err: any) {
      console.error('Error al acceder al micrófono:', err);
      setErrorMessage('No se pudo acceder al micrófono. Por favor permite los permisos de audio en tu navegador.');
    }
  };

  // Toggle monitoring (hear voice through headphones)
  const handleToggleMonitoring = () => {
    if (!monitorGainRef.current) return;
    const nextState = !isMonitoring;
    setIsMonitoring(nextState);
    monitorGainRef.current.gain.value = nextState ? 0.7 : 0;
  };

  // Pitch estimation (Autocorrelation)
  const autoCorrelate = (buffer: Float32Array, sampleRate: number): number => {
    const SIZE = buffer.length;
    let sumOfSquares = 0;
    for (let i = 0; i < SIZE; i++) {
      const val = buffer[i];
      sumOfSquares += val * val;
    }
    const rootMeanSquare = Math.sqrt(sumOfSquares / SIZE);
    if (rootMeanSquare < 0.015) return -1; // Not enough signal

    let r1 = 0, r2 = SIZE - 1;
    const threshold = 0.2;
    for (let i = 0; i < SIZE / 2; i++) {
      if (Math.abs(buffer[i]) < threshold) {
        r1 = i;
        break;
      }
    }
    for (let i = 1; i < SIZE / 2; i++) {
      if (Math.abs(buffer[SIZE - i]) < threshold) {
        r2 = SIZE - i;
        break;
      }
    }

    const trimmed = buffer.slice(r1, r2);
    const c = new Float32Array(trimmed.length);
    for (let i = 0; i < trimmed.length; i++) {
      for (let j = 0; j < trimmed.length - i; j++) {
        c[i] = c[i] + trimmed[j] * trimmed[j + i];
      }
    }

    let d = 0;
    while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < trimmed.length; i++) {
      if (c[i] > maxval) {
        maxval = c[i];
        maxpos = i;
      }
    }
    let T0 = maxpos;
    if (T0 > 0 && T0 < trimmed.length - 1) {
      const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
      const a = (x1 + x3 - 2 * x2) / 2;
      const b = (x3 - x1) / 2;
      if (a) T0 = T0 - b / (2 * a);
    }

    return sampleRate / T0;
  };

  const noteStrings = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const noteFromPitch = (frequency: number): string => {
    const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    const midi = Math.round(noteNum) + 69;
    const noteName = noteStrings[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    return `${noteName}${octave}`;
  };

  const startPitchAndLevelLoop = (analyser: AnalyserNode) => {
    const timeData = new Float32Array(analyser.fftSize);

    const update = () => {
      analyser.getFloatTimeDomainData(timeData);

      // RMS level
      let sum = 0;
      for (let i = 0; i < timeData.length; i++) {
        sum += timeData[i] * timeData[i];
      }
      const rms = Math.sqrt(sum / timeData.length);
      setVocalLevel(Math.min(100, rms * 250));

      // Pitch
      if (audioCtx) {
        const pitch = autoCorrelate(timeData, audioCtx.sampleRate);
        if (pitch !== -1 && pitch >= 65 && pitch <= 1000) {
          setPitchNote(noteFromPitch(pitch));
        } else {
          setPitchNote('--');
        }
      }

      animationFrameRef.current = requestAnimationFrame(update);
    };

    update();
  };

  // Start recording voice while playing instrumental
  const handleStartRecording = () => {
    if (!mediaStreamRef.current) return;
    recordedChunksRef.current = [];
    setRecordedAudioUrl(null);
    setRecordedBlob(null);

    try {
      const mediaRecorder = new MediaRecorder(mediaStreamRef.current, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined,
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedAudioUrl(url);
      };

      mediaRecorder.start(100);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      // Start the instrumental track synchronized
      onStartInstrumentalPlayback();
    } catch (err) {
      console.error('Error al iniciar grabación:', err);
    }
  };

  // Stop recording
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      onStopInstrumentalPlayback();
    }
  };

  // Clean up
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex flex-col gap-5 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Mic className="w-4 h-4 text-rose-500" />
            Estudio de Grabación Karaoke (Canta sobre la Música)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Conecta tu micrófono para cantar sobre la pista instrumental extraída y grabar tu actuación.
          </p>
        </div>

        {!hasMicPermission ? (
          <button
            type="button"
            onClick={handleEnableMic}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-md self-start sm:self-auto"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Activar Micrófono</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleMonitoring}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border ${
                isMonitoring
                  ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title="Escúchate en tiempo real (Recomendado usar auriculares para evitar eco)"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Monitoreo: {isMonitoring ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="p-3 bg-rose-950/40 border border-rose-800/80 rounded-lg text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {hasMicPermission && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Vocal Level & Pitch Detector */}
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Nivel de Entrada Mic:</span>
              <span className="font-mono tabular-nums text-slate-200 font-medium">
                {Math.round(vocalLevel)}%
              </span>
            </div>
            {/* Level meter bar */}
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-75 ${
                  vocalLevel > 80 ? 'bg-rose-500' : vocalLevel > 40 ? 'bg-amber-400' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, vocalLevel)}%` }}
              />
            </div>

            {/* Live pitch detector */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-xs">
              <span className="text-slate-400">Nota detectada (Afinación):</span>
              <span className="font-mono text-sm font-bold text-indigo-400">
                {pitchNote}
              </span>
            </div>
          </div>

          {/* Record Actions */}
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 flex flex-col justify-center items-center gap-3 md:col-span-2">
            {!isRecording ? (
              <button
                type="button"
                onClick={handleStartRecording}
                disabled={!instrumentalBuffer}
                className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg disabled:opacity-50 disabled:pointer-events-none"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                <span>Grabar Canto con el Instrumental</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopRecording}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer border border-rose-500/40"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Detener y Guardar Grabación</span>
              </button>
            )}

            <div className="text-[11px] text-slate-400 text-center">
              {isRecording
                ? 'Grabando tu voz en vivo sincronizada con la música...'
                : 'Usa auriculares para evitar que la música se cuele en tu micrófono.'}
            </div>
          </div>
        </div>
      )}

      {/* Finished Recording Player & Download */}
      {recordedAudioUrl && (
        <div className="bg-slate-950 p-4 rounded-lg border border-indigo-900/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Tu Grabación de Karaoke</div>
              <div className="text-[11px] text-slate-400">Audio listo para reproducir y guardar</div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <audio
              ref={audioPreviewRef}
              src={recordedAudioUrl}
              controls
              className="h-9 max-w-full"
            />

            <a
              href={recordedAudioUrl}
              download="mi_karaoke_grabado.webm"
              className="p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer"
              title="Descargar mi grabación"
            >
              <Download className="w-4 h-4" />
            </a>

            <button
              type="button"
              onClick={() => {
                setRecordedAudioUrl(null);
                setRecordedBlob(null);
              }}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
              title="Descartar grabación"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
