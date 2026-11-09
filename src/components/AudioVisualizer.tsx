import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  audioBuffer: AudioBuffer | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  analyserNode: AnalyserNode | null;
  activeMode: 'instrumental' | 'vocal_isolated' | 'original' | 'custom';
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  audioBuffer,
  currentTime,
  duration,
  isPlaying,
  onSeek,
  analyserNode,
  activeMode,
}) => {
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Draw static waveform when buffer changes
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas || !audioBuffer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const channelData0 = audioBuffer.getChannelData(0);
    const channelData1 = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : channelData0;
    const step = Math.ceil(channelData0.length / width);
    const amp = height / 2;

    // Draw background grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, amp);
    ctx.lineTo(width, amp);
    ctx.stroke();

    // Draw waveform bars
    for (let x = 0; x < width; x++) {
      const start = x * step;
      let minL = 1.0;
      let maxL = -1.0;
      let minR = 1.0;
      let maxR = -1.0;

      for (let j = 0; j < step; j += 4) {
        const valL = channelData0[start + j] || 0;
        const valR = channelData1[start + j] || 0;
        if (valL < minL) minL = valL;
        if (valL > maxL) maxL = valL;
        if (valR < minR) minR = valR;
        if (valR > maxR) maxR = valR;
      }

      // Upper half (Left channel / Stereo)
      const top = Math.max(2, (maxL - minL) * amp * 0.9);
      // Mode-specific color gradient
      const progress = currentTime / (duration || 1);
      const isPlayed = x / width <= progress;

      if (isPlayed) {
        ctx.fillStyle = activeMode === 'instrumental'
          ? '#818cf8' // Indigo/violet
          : activeMode === 'vocal_isolated'
          ? '#f43f5e' // Rose
          : '#38bdf8'; // Sky
      } else {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.28)';
      }

      ctx.fillRect(x, amp - top * 0.5, 1, top);
    }
  }, [audioBuffer, currentTime, duration, activeMode]);

  // Real-time Spectrum Analyzer & Meter loop
  useEffect(() => {
    const canvas = spectrumCanvasRef.current;
    if (!canvas || !analyserNode) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      analyserNode.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Draw 48 frequency bars
      const barCount = 48;
      const barWidth = (width / barCount) - 2;

      for (let i = 0; i < barCount; i++) {
        // Logarithmic frequency index
        const index = Math.floor(Math.pow(i / barCount, 2) * (bufferLength * 0.6));
        const value = isPlaying ? dataArray[index] : 4;
        const barHeight = Math.max(3, (value / 255) * height);

        const x = i * (barWidth + 2);
        const y = height - barHeight;

        // Gradient for bars
        const grad = ctx.createLinearGradient(0, y, 0, height);
        if (activeMode === 'instrumental') {
          grad.addColorStop(0, '#a855f7');
          grad.addColorStop(1, '#6366f1');
        } else if (activeMode === 'vocal_isolated') {
          grad.addColorStop(0, '#fb7185');
          grad.addColorStop(1, '#e11d48');
        } else {
          grad.addColorStop(0, '#38bdf8');
          grad.addColorStop(1, '#0284c7');
        }

        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barWidth, barHeight);
      }
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyserNode, isPlaying, activeMode]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newProgress = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(newProgress * duration);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-xl">
      <div className="flex items-center justify-between text-xs font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <span className="text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
            Visualizador de Señal Estéreo
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-indigo-400 font-medium">
            {activeMode === 'instrumental' && 'Modo Karaoke Instrumental'}
            {activeMode === 'vocal_isolated' && 'Modo Voz Aislada (Acapella)'}
            {activeMode === 'original' && 'Pista Original Completa'}
            {activeMode === 'custom' && 'Mezcla Personalizada'}
          </span>
        </div>
        <div className="tabular-nums flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800/80">
          <span className="text-white font-medium">{formatTime(currentTime)}</span>
          <span className="text-slate-600">/</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Interactive Waveform Display */}
      <div
        onClick={handleCanvasClick}
        className="relative w-full h-24 bg-slate-950/80 rounded-lg overflow-hidden border border-slate-800/60 cursor-pointer group hover:border-slate-700 transition-colors"
        title="Haz clic para saltar a cualquier punto de la canción"
      >
        <canvas
          ref={waveformCanvasRef}
          width={800}
          height={96}
          className="w-full h-full block"
        />

        {/* Current Playhead Line */}
        {duration > 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] pointer-events-none transition-all duration-75"
            style={{ left: `${(currentTime / duration) * 100}%` }}
          >
            <div className="w-2.5 h-2.5 bg-white rounded-full -ml-1 -top-1 absolute shadow-md" />
          </div>
        )}

        {/* Empty state prompt if no audio is loaded yet */}
        {!audioBuffer && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 font-medium">
            Selecciona una pista de demostración o sube tu propia canción
          </div>
        )}
      </div>

      {/* Live Spectrum Analyzer Strip */}
      <div className="flex items-center gap-3">
        <div className="w-full h-10 bg-slate-950/90 rounded-lg p-1 border border-slate-800/60 flex items-center">
          <canvas
            ref={spectrumCanvasRef}
            width={400}
            height={36}
            className="w-full h-full block"
          />
        </div>
      </div>
    </div>
  );
};
