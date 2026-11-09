import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Mic2,
  Music,
  Radio,
  Sliders,
  Download,
  Flame,
  Gauge,
} from 'lucide-react';
import { DspParameters } from '../utils/audioDsp';

interface AudioControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onRestart: () => void;
  params: DspParameters;
  onUpdateParams: (newParams: Partial<DspParameters>) => void;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  pitchShiftSemitones: number;
  onPitchShiftChange: (semitones: number) => void;
  onExportWav: () => void;
  isExporting: boolean;
  disabled: boolean;
}

export const AudioControls: React.FC<AudioControlsProps> = ({
  isPlaying,
  onPlayPause,
  onRestart,
  params,
  onUpdateParams,
  playbackRate,
  onPlaybackRateChange,
  pitchShiftSemitones,
  onPitchShiftChange,
  onExportWav,
  isExporting,
  disabled,
}) => {
  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex flex-col gap-6 shadow-xl">
      {/* Primary Transport & Mode Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        {/* Playback Transport Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onRestart}
            disabled={disabled}
            className="p-2.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            title="Reiniciar desde el inicio (00:00)"
            aria-label="Reiniciar"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onPlayPause}
            disabled={disabled}
            className={`px-5 py-2.5 rounded-lg flex items-center gap-2 font-medium text-sm transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:pointer-events-none ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white font-semibold'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>Pausar</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Reproducir</span>
              </>
            )}
          </button>

          {/* Quick status text */}
          <span className="text-xs text-slate-400 hidden sm:inline">
            {isPlaying ? 'Reproduciendo en tiempo real' : 'Listo para reproducir'}
          </span>
        </div>

        {/* Stem Separation Modes (Segmented Control) */}
        <div className="flex items-center p-1 bg-slate-950 rounded-lg border border-slate-800/80 self-start md:self-auto overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => onUpdateParams({ mode: 'instrumental', vocalCut: 1.0 })}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              params.mode === 'instrumental'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Sin Voz (Karaoke)</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateParams({ mode: 'vocal_isolated' })}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              params.mode === 'vocal_isolated'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mic2 className="w-3.5 h-3.5" />
            <span>Solo Voz (Acapella)</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateParams({ mode: 'original' })}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              params.mode === 'original'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Original (A/B)</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateParams({ mode: 'custom' })}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              params.mode === 'custom'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Manual</span>
          </button>
        </div>

        {/* Download WAV Button */}
        <button
          type="button"
          onClick={onExportWav}
          disabled={disabled || isExporting}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-md self-start md:self-auto cursor-pointer disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap"
          title="Descargar la pista instrumental en audio WAV sin pérdida"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isExporting ? 'Procesando WAV...' : 'Descargar Instrumental'}</span>
        </button>
      </div>

      {/* DSP Sliders & Parametric Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Vocal Attenuation Depth */}
        <div className="bg-slate-950/70 p-3.5 rounded-lg border border-slate-800/80 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium flex items-center gap-1.5">
              <Mic2 className="w-3.5 h-3.5 text-indigo-400" />
              Atenuación de Voz
            </span>
            <span className="font-mono tabular-nums text-indigo-400 font-semibold">
              {Math.round(params.vocalCut * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.02"
            value={params.vocalCut}
            disabled={params.mode !== 'custom' && params.mode !== 'instrumental'}
            onChange={(e) => onUpdateParams({ vocalCut: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0% (Voz completa)</span>
            <span>100% (Muda)</span>
          </div>
        </div>

        {/* Bass & Kick Preservation */}
        <div className="bg-slate-950/70 p-3.5 rounded-lg border border-slate-800/80 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Retención de Graves / Bombo
            </span>
            <span className="font-mono tabular-nums text-amber-400 font-semibold">
              {Math.round(params.bassPreserve * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1.2"
            step="0.02"
            value={params.bassPreserve}
            onChange={(e) => onUpdateParams({ bassPreserve: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>Corte total</span>
            <span>Pegada completa</span>
          </div>
        </div>

        {/* Stereo Width Enhancer */}
        <div className="bg-slate-950/70 p-3.5 rounded-lg border border-slate-800/80 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-sky-400" />
              Amplitud Estéreo (L/R)
            </span>
            <span className="font-mono tabular-nums text-sky-400 font-semibold">
              {params.stereoWidth.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="1.8"
            step="0.05"
            value={params.stereoWidth}
            onChange={(e) => onUpdateParams({ stereoWidth: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>Estrecho (0.5x)</span>
            <span>Espacial (1.8x)</span>
          </div>
        </div>

        {/* Master Output Gain */}
        <div className="bg-slate-950/70 p-3.5 rounded-lg border border-slate-800/80 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              Ganancia de Salida
            </span>
            <span className="font-mono tabular-nums text-emerald-400 font-semibold">
              {(params.gain * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="0.3"
            max="1.5"
            step="0.05"
            value={params.gain}
            onChange={(e) => onUpdateParams({ gain: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>Suave (30%)</span>
            <span>Fuerte (150%)</span>
          </div>
        </div>
      </div>

      {/* Musical Tools for Singers (Key Shifter & Tempo) */}
      <div className="bg-slate-950/50 rounded-lg p-3.5 border border-slate-800/60 flex flex-wrap items-center justify-between gap-4">
        {/* Pitch Shift / Transpose */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
            <Gauge className="w-3.5 h-3.5 text-indigo-400" />
            <span>Tono / Semitonos:</span>
          </div>
          <div className="flex items-center gap-1">
            {[-3, -2, -1, 0, 1, 2, 3].map((semi) => (
              <button
                key={semi}
                type="button"
                onClick={() => onPitchShiftChange(semi)}
                className={`w-7 h-7 text-xs font-mono rounded cursor-pointer transition-colors ${
                  pitchShiftSemitones === semi
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
                title={`Ajustar tono a ${semi > 0 ? `+${semi}` : semi} semitonos`}
              >
                {semi > 0 ? `+${semi}` : semi}
              </button>
            ))}
          </div>
        </div>

        {/* Playback Speed */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-300 font-medium">Velocidad:</span>
          <div className="flex items-center gap-1">
            {[0.8, 0.9, 1.0, 1.1, 1.2].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => onPlaybackRateChange(rate)}
                className={`px-2 py-1 text-xs font-mono rounded cursor-pointer transition-colors ${
                  playbackRate === rate
                    ? 'bg-slate-700 text-white font-semibold'
                    : 'bg-slate-800/70 text-slate-400 hover:text-white'
                }`}
              >
                {rate.toFixed(1)}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
