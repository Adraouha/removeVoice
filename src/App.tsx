/**
 * VocalRemover Pro - Extractor Instrumental y Karaoke Studio
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Music,
  Disc,
  Sparkles,
  Info,
  CheckCircle2,
  FileAudio,
  Radio,
  Sliders,
  Volume2,
} from 'lucide-react';
import {
  DspParameters,
  DEFAULT_DSP_PARAMS,
  processAudioBuffer,
  encodeAudioBufferToWav,
  generateSyntheticDemoSong,
} from './utils/audioDsp';
import { AudioVisualizer } from './components/AudioVisualizer';
import { AudioControls } from './components/AudioControls';
import { KaraokeRecorder } from './components/KaraokeRecorder';
import { KaraokeLyrics } from './components/KaraokeLyrics';
import { TechExplainer } from './components/TechExplainer';

export default function App() {
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);
  const [originalBuffer, setOriginalBuffer] = useState<AudioBuffer | null>(null);
  const [processedBuffer, setProcessedBuffer] = useState<AudioBuffer | null>(null);
  const [songName, setSongName] = useState<string>('Pop/Funk Groove (Pista Demo)');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [params, setParams] = useState<DspParameters>(DEFAULT_DSP_PARAMS);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [pitchShiftSemitones, setPitchShiftSemitones] = useState<number>(0);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);
  const [isProcessingDsp, setIsProcessingDsp] = useState<boolean>(false);

  // References for Web Audio Nodes
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const timerIntervalRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Ensure AudioContext is ready
  const getOrCreateAudioCtx = (): AudioContext => {
    if (!audioCtx) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      setAudioCtx(ctx);
      return ctx;
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  };

  // Setup Analyser & Master Gain once audioCtx is available
  useEffect(() => {
    if (!audioCtx) return;

    if (!analyserNodeRef.current) {
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      analyserNodeRef.current = analyser;

      const masterGain = audioCtx.createGain();
      masterGain.gain.value = 1.0;
      masterGainRef.current = masterGain;

      analyser.connect(masterGain);
      masterGain.connect(audioCtx.destination);
    }
  }, [audioCtx]);

  // Load default demo song on initial mount
  useEffect(() => {
    loadDemoTrack('pop_funk', false);
  }, []);

  // Recalculate DSP buffer when params or originalBuffer change
  useEffect(() => {
    if (!originalBuffer) return;
    const ctx = getOrCreateAudioCtx();

    setIsProcessingDsp(true);
    const timer = setTimeout(() => {
      try {
        const processed = processAudioBuffer(originalBuffer, ctx, params);
        setProcessedBuffer(processed);

        // If currently playing, smoothly hot-swap the source without restarting time
        if (isPlaying && sourceNodeRef.current) {
          const currentOffset = getCurrentPlaybackOffset();
          stopCurrentPlayback();
          startPlaybackAt(currentOffset, processed);
        }
      } catch (err) {
        console.error('Error en procesamiento DSP:', err);
      } finally {
        setIsProcessingDsp(false);
      }
    }, 40);

    return () => clearTimeout(timer);
  }, [params, originalBuffer]);

  const showNotification = (msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => {
      setStatusNotification(null);
    }, 4000);
  };

  // Load procedural demo track
  const loadDemoTrack = (type: 'pop_funk' | 'synthwave', autoPlay: boolean = true) => {
    stopCurrentPlayback();
    const ctx = getOrCreateAudioCtx();

    const title = type === 'pop_funk' ? 'Pop/Funk Groove (Pista Demo)' : 'Synthwave 80s (Pista Demo)';
    setSongName(title);

    const buffer = generateSyntheticDemoSong(ctx, type);
    setOriginalBuffer(buffer);
    setDuration(buffer.duration);
    setCurrentTime(0);
    pausedAtRef.current = 0;

    const initialProcessed = processAudioBuffer(buffer, ctx, params);
    setProcessedBuffer(initialProcessed);

    showNotification(`Cargada pista: ${title}`);

    if (autoPlay) {
      setTimeout(() => {
        startPlaybackAt(0, initialProcessed);
      }, 100);
    }
  };

  // Handle local user audio file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    stopCurrentPlayback();
    const ctx = getOrCreateAudioCtx();
    showNotification(`Decodificando "${file.name}"...`);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);

      setSongName(file.name.replace(/\.[^/.]+$/, ''));
      setOriginalBuffer(decodedBuffer);
      setDuration(decodedBuffer.duration);
      setCurrentTime(0);
      pausedAtRef.current = 0;

      const processed = processAudioBuffer(decodedBuffer, ctx, params);
      setProcessedBuffer(processed);
      showNotification(`¡"${file.name}" cargada con éxito!`);
    } catch (err) {
      console.error('Error al decodificar audio:', err);
      showNotification('Error al abrir el archivo de audio. Asegúrate de que sea un archivo MP3, WAV o FLAC válido.');
    }
  };

  // Audio Playback Engine
  const getCurrentPlaybackOffset = (): number => {
    if (!audioCtx || !isPlaying) return pausedAtRef.current;
    const effectiveRate = playbackRate * Math.pow(2, pitchShiftSemitones / 12);
    const elapsed = (audioCtx.currentTime - startTimeRef.current) * effectiveRate;
    return Math.min(duration, pausedAtRef.current + elapsed);
  };

  const startPlaybackAt = (offset: number, customBuffer?: AudioBuffer) => {
    const ctx = getOrCreateAudioCtx();
    const bufferToPlay = customBuffer || processedBuffer || originalBuffer;
    if (!bufferToPlay) return;

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (e) {
        // Ignored
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = bufferToPlay;

    // Pitch shift + tempo rate
    const pitchRatio = Math.pow(2, pitchShiftSemitones / 12);
    source.playbackRate.value = playbackRate * pitchRatio;

    if (analyserNodeRef.current) {
      source.connect(analyserNodeRef.current);
    } else {
      source.connect(ctx.destination);
    }

    source.onended = () => {
      // Natural end of song
      if (getCurrentPlaybackOffset() >= duration - 0.2) {
        setIsPlaying(false);
        setCurrentTime(0);
        pausedAtRef.current = 0;
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      }
    };

    const boundedOffset = Math.max(0, Math.min(bufferToPlay.duration - 0.05, offset));
    source.start(0, boundedOffset);

    sourceNodeRef.current = source;
    startTimeRef.current = ctx.currentTime;
    pausedAtRef.current = boundedOffset;
    setIsPlaying(true);

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = window.setInterval(() => {
      const pos = getCurrentPlaybackOffset();
      setCurrentTime(pos);
    }, 50);
  };

  const stopCurrentPlayback = () => {
    if (sourceNodeRef.current) {
      try {
        pausedAtRef.current = getCurrentPlaybackOffset();
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (e) {
        // Ignored
      }
      sourceNodeRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsPlaying(false);
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      stopCurrentPlayback();
    } else {
      startPlaybackAt(pausedAtRef.current);
    }
  };

  const handleRestart = () => {
    stopCurrentPlayback();
    pausedAtRef.current = 0;
    setCurrentTime(0);
    startPlaybackAt(0);
  };

  const handleSeek = (newTime: number) => {
    const wasPlaying = isPlaying;
    stopCurrentPlayback();
    pausedAtRef.current = newTime;
    setCurrentTime(newTime);
    if (wasPlaying) {
      startPlaybackAt(newTime);
    }
  };

  const handlePlaybackRateChange = (newRate: number) => {
    setPlaybackRate(newRate);
    if (sourceNodeRef.current) {
      const pitchRatio = Math.pow(2, pitchShiftSemitones / 12);
      sourceNodeRef.current.playbackRate.value = newRate * pitchRatio;
    }
  };

  const handlePitchShiftChange = (semitones: number) => {
    setPitchShiftSemitones(semitones);
    if (sourceNodeRef.current) {
      const pitchRatio = Math.pow(2, semitones / 12);
      sourceNodeRef.current.playbackRate.value = playbackRate * pitchRatio;
    }
  };

  // Export & Download WAV
  const handleExportWav = async () => {
    if (!processedBuffer) return;
    setIsExporting(true);
    showNotification('Generando archivo WAV estéreo de alta fidelidad...');

    try {
      // Allow UI thread to show loading state
      await new Promise((r) => setTimeout(r, 60));
      const wavBlob = encodeAudioBufferToWav(processedBuffer);
      const url = URL.createObjectURL(wavBlob);

      const a = document.createElement('a');
      a.href = url;
      const cleanName = songName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const modeSuffix = params.mode === 'vocal_isolated' ? 'acapella_vocal' : 'instrumental_karaoke';
      a.download = `${cleanName}_${modeSuffix}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showNotification('¡Pista WAV descargada con éxito!');
    } catch (err) {
      console.error('Error al exportar WAV:', err);
      showNotification('Hubo un error al exportar el archivo de audio.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Toast Notification */}
      {statusNotification && (
        <div className="fixed top-5 right-5 z-50 bg-indigo-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-2xl flex items-center gap-2 border border-indigo-400/40 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusNotification}</span>
        </div>
      )}

      {/* Top Bar Contract (3 zones separated by gap-8: Brand - Nav links - 1 Primary Action) */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        {/* Zone 1: Single text wordmark */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md">
            <Music className="w-4 h-4" />
          </div>
          <a
            href="/"
            className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 hover:text-indigo-300 transition-colors"
          >
            VocalRemover Pro
          </a>
        </div>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <a href="#estudio-dsp" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
            Estudio Instrumental
          </a>
          <a href="#karaoke-recorder" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
            Grabador Karaoke
          </a>
          <a href="#lyrics-teleprompter" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
            Teleprompter Letra
          </a>
          <a href="#explicacion-tecnica" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
            ¿Cómo Funciona?
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 shadow-md cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Subir Mi Canción</span>
          </button>
        </div>
      </header>

      {/* Main Studio Viewport */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
        {/* Track Header & Quick Demo Selectors */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <FileAudio className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Pista actual cargada</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {duration > 0 ? `${Math.round(duration)} segundos` : '0s'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-400 font-medium">Estéreo 44.1kHz</span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight mt-0.5 truncate max-w-md sm:max-w-xl">
                {songName}
              </h1>
            </div>
          </div>

          {/* Quick Demo Switchers */}
          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
            <span className="text-xs text-slate-400 font-medium mr-1">Probar demos:</span>
            <button
              type="button"
              onClick={() => loadDemoTrack('pop_funk')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer border border-slate-700 flex items-center gap-1.5"
            >
              <Disc className="w-3 h-3 text-indigo-400" />
              <span>Pop/Funk (Voz + Metales)</span>
            </button>
            <button
              type="button"
              onClick={() => loadDemoTrack('synthwave')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer border border-slate-700 flex items-center gap-1.5"
            >
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>Synthwave 80s</span>
            </button>
          </div>
        </div>

        {/* Section 1: Interactive Waveform & Spectrum Visualizer */}
        <section id="estudio-dsp" className="flex flex-col gap-4">
          <AudioVisualizer
            audioBuffer={processedBuffer || originalBuffer}
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            onSeek={handleSeek}
            analyserNode={analyserNodeRef.current}
            activeMode={params.mode}
          />

          {/* Section 2: Audio Transport, Mode Selector & DSP Sliders */}
          <AudioControls
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            onRestart={handleRestart}
            params={params}
            onUpdateParams={(newP) => setParams((prev) => ({ ...prev, ...newP }))}
            playbackRate={playbackRate}
            onPlaybackRateChange={handlePlaybackRateChange}
            pitchShiftSemitones={pitchShiftSemitones}
            onPitchShiftChange={handlePitchShiftChange}
            onExportWav={handleExportWav}
            isExporting={isExporting}
            disabled={!originalBuffer}
          />
        </section>

        {/* Section 3: Karaoke Teleprompter & Recording Studio Split */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section id="lyrics-teleprompter">
            <KaraokeLyrics
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlaying}
              songTitle={songName}
            />
          </section>

          <section id="karaoke-recorder">
            <KaraokeRecorder
              instrumentalBuffer={processedBuffer}
              isPlaying={isPlaying}
              onStartInstrumentalPlayback={() => {
                if (!isPlaying) startPlaybackAt(0);
              }}
              onStopInstrumentalPlayback={() => {
                if (isPlaying) stopCurrentPlayback();
              }}
              audioCtx={audioCtx}
            />
          </section>
        </div>

        {/* Section 4: Technical Explanation & Educational Guide */}
        <section id="explicacion-tecnica">
          <TechExplainer />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 px-6 py-6 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">VocalRemover Pro</span>
            <span aria-hidden="true">·</span>
            <span>Estudio de Aislamiento Acústico y Grabación Karaoke</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Web Audio API DSP</span>
            <span aria-hidden="true">·</span>
            <span>Exportación WAV 16-bit PCM</span>
            <span aria-hidden="true">·</span>
            <span>100% Privado en tu Navegador</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
