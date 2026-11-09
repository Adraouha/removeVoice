import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Cpu, Radio, Disc, Sparkles } from 'lucide-react';

export const TechExplainer: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(true);

  return (
    <div className="w-full bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-lg transition-all">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-sm font-semibold text-white">
            ¿Cómo funciona la eliminación de voz y extracción instrumental? (Explicación Técnica)
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {isOpen && (
        <div className="p-5 pt-0 border-t border-slate-800/60 flex flex-col gap-4 text-xs text-slate-300 leading-relaxed">
          <p className="text-slate-200">
            <strong className="text-indigo-400 font-semibold">¡Sí, somos 100% capaces!</strong>{' '}
            Esta aplicación procesa cualquier canción en tiempo real en tu navegador mediante técnicas de{' '}
            <strong>Procesamiento Digital de Señales (DSP)</strong> y matrices Mid-Side estéreo, extrayendo el instrumental puro para karaoke.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="bg-slate-950/70 p-3.5 rounded-lg border border-slate-800/80 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-indigo-400 font-semibold text-xs">
                <Radio className="w-3.5 h-3.5" />
                <span>1. Cancelación Canal Central (M/S)</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                En la producción musical moderna, la voz principal del cantante se coloca casi siempre en el centro exacto del panorama estéreo (L = R). Restando los canales o atenuando el canal central (Mid), la voz se anula dejando solo los instrumentos abiertos a los lados (Side).
              </p>
            </div>

            <div className="bg-slate-950/70 p-3.5 rounded-lg border border-slate-800/80 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-xs">
                <Disc className="w-3.5 h-3.5" />
                <span>2. Filtros Crossover de Graves</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Si solo restas los canales, el bombo y el bajo también desaparecerían porque también están en el centro. Nuestro algoritmo aplica un filtro Butterworth que aísla las frecuencias subgraves (&lt;180 Hz) para mantener la pegada del ritmo intacta.
              </p>
            </div>

            <div className="bg-slate-950/70 p-3.5 rounded-lg border border-slate-800/80 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-purple-400 font-semibold text-xs">
                <Cpu className="w-3.5 h-3.5" />
                <span>3. Modelos IA (Demucs / Spleeter)</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Para reverberaciones vocales complejas y coros con paneo estéreo, la tecnología complementaria utiliza redes neuronales profundas (U-Nets y Transformers espectrales) entrenadas con millones de pistas multicanal.
              </p>
            </div>
          </div>

          <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>
              💡 <strong>Consejo para el mejor resultado:</strong> Sube archivos en estéreo (MP3, WAV o FLAC). Si una pista está grabada en mono estricto, la separación estéreo no es posible.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
