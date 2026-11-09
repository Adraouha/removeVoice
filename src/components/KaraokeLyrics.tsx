import React, { useState, useEffect, useRef } from 'react';
import { Type, Edit3, Check, Sparkles, BookOpen } from 'lucide-react';

interface KaraokeLyricsProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  songTitle: string;
}

interface LyricLine {
  time: number;
  text: string;
}

const DEFAULT_POP_LYRICS: LyricLine[] = [
  { time: 0, text: "♪ [Intro instrumental - Prepárate para cantar] ♪" },
  { time: 2, text: "Luces en la noche brillan en la ciudad" },
  { time: 4, text: "Siento el ritmo que empieza a sonar" },
  { time: 6, text: "Bailando bajo el cielo sin mirar atrás" },
  { time: 8, text: "Esta noche es nuestra para soñar" },
  { time: 10, text: "¡Sube el volumen y déjate llevar!" },
  { time: 12, text: "Nadie nos puede detener jamás" },
  { time: 14, text: "♪ [Solo instrumental y final] ♪" },
];

export const KaraokeLyrics: React.FC<KaraokeLyricsProps> = ({
  currentTime,
  duration,
  isPlaying,
  songTitle,
}) => {
  const [lyrics, setLyrics] = useState<LyricLine[]>(DEFAULT_POP_LYRICS);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [rawText, setRawText] = useState<string>('');
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>('large');
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Initialize raw text on first load
  useEffect(() => {
    setRawText(lyrics.map((l) => l.text).join('\n'));
  }, []);

  // Determine current active lyric line
  const activeLineIndex = lyrics.reduce((activeIdx, line, idx) => {
    if (currentTime >= line.time) {
      return idx;
    }
    return activeIdx;
  }, 0);

  // Auto-scroll to active line
  useEffect(() => {
    const activeEl = document.getElementById(`lyric-line-${activeLineIndex}`);
    if (activeEl && scrollContainerRef.current) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeLineIndex]);

  const handleSaveLyrics = () => {
    const lines = rawText.split('\n').filter((l) => l.trim().length > 0);
    const lineDuration = duration > 0 ? duration / Math.max(1, lines.length) : 3;

    const newLyrics: LyricLine[] = lines.map((text, idx) => ({
      time: Math.round(idx * lineDuration * 10) / 10,
      text: text.trim(),
    }));

    setLyrics(newLyrics.length > 0 ? newLyrics : DEFAULT_POP_LYRICS);
    setIsEditing(false);
  };

  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'normal':
        return 'text-base sm:text-lg';
      case 'large':
        return 'text-xl sm:text-2xl';
      case 'xlarge':
        return 'text-2xl sm:text-3xl';
    }
  };

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">
            Teleprompter de Letra Karaoke
          </h3>
          <span className="text-xs text-slate-500">· {songTitle}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Font Size Toggle */}
          <div className="flex items-center bg-slate-950 p-1 rounded-md border border-slate-800 text-xs text-slate-400">
            <button
              type="button"
              onClick={() => setFontSize('normal')}
              className={`px-2 py-0.5 rounded cursor-pointer ${fontSize === 'normal' ? 'bg-slate-800 text-white font-bold' : ''}`}
            >
              A
            </button>
            <button
              type="button"
              onClick={() => setFontSize('large')}
              className={`px-2 py-0.5 rounded cursor-pointer ${fontSize === 'large' ? 'bg-slate-800 text-white font-bold text-sm' : ''}`}
            >
              A+
            </button>
            <button
              type="button"
              onClick={() => setFontSize('xlarge')}
              className={`px-2 py-0.5 rounded cursor-pointer ${fontSize === 'xlarge' ? 'bg-slate-800 text-white font-bold text-base' : ''}`}
            >
              A++
            </button>
          </div>

          {/* Edit Lyrics Button */}
          <button
            type="button"
            onClick={() => {
              if (isEditing) {
                handleSaveLyrics();
              } else {
                setRawText(lyrics.map((l) => l.text).join('\n'));
                setIsEditing(true);
              }
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
          >
            {isEditing ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Guardar Letra</span>
              </>
            ) : (
              <>
                <Edit3 className="w-3.5 h-3.5" />
                <span>Editar Letra</span>
              </>
            )}
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-400">
            Pega o escribe cada verso en una línea distinta. La sincronización se distribuirá a lo largo de la canción:
          </label>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={7}
            className="w-full bg-slate-950 text-slate-100 p-3 rounded-lg border border-slate-800 text-sm focus:outline-none focus:border-indigo-500 font-sans"
            placeholder="Escribe o pega aquí la letra de la canción..."
          />
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className="relative h-44 sm:h-52 overflow-y-auto bg-slate-950/80 rounded-lg p-6 border border-slate-800/80 flex flex-col items-center gap-4 text-center select-none"
        >
          {lyrics.map((line, idx) => {
            const isActive = idx === activeLineIndex && isPlaying;
            const isPast = idx < activeLineIndex;

            return (
              <div
                key={idx}
                id={`lyric-line-${idx}`}
                className={`transition-all duration-300 font-medium ${getFontSizeClass()} ${
                  isActive
                    ? 'text-indigo-300 font-bold scale-105 drop-shadow-[0_0_12px_rgba(99,102,241,0.6)]'
                    : isPast
                    ? 'text-slate-600'
                    : 'text-slate-400 opacity-60'
                }`}
              >
                {line.text}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
