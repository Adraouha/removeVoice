/**
 * Audio DSP engine for Vocal Removal, Karaoke Isolation, and WAV encoding.
 * Implements Center Channel Cancellation with Multi-Band Crossover Filter (OOPS + Mid-Side processing).
 */

export interface DspParameters {
  vocalCut: number; // 0 (original) to 1 (full cut)
  bassPreserve: number; // 0 to 1 (preserves kick and bass in center < 180Hz)
  vocalLowFreq: number; // lower boundary for vocal band, default ~180 Hz
  vocalHighFreq: number; // upper boundary for vocal band, default ~4500 Hz
  stereoWidth: number; // 0.5 to 1.8 (enhances side instruments)
  gain: number; // output gain multiplier, default 1.0
  mode: 'instrumental' | 'vocal_isolated' | 'original' | 'custom';
}

export const DEFAULT_DSP_PARAMS: DspParameters = {
  vocalCut: 1.0,
  bassPreserve: 0.95,
  vocalLowFreq: 180,
  vocalHighFreq: 4500,
  stereoWidth: 1.15,
  gain: 1.05,
  mode: 'instrumental',
};

/**
 * Creates 2nd order Butterworth IIR filter coefficients
 */
function createBiquadLowpass(cutoff: number, sampleRate: number) {
  const w0 = (2 * Math.PI * cutoff) / sampleRate;
  const alpha = Math.sin(w0) / (2 * Math.SQRT2);
  const cosw0 = Math.cos(w0);

  const b0 = (1 - cosw0) / 2;
  const b1 = 1 - cosw0;
  const b2 = (1 - cosw0) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosw0;
  const a2 = 1 - alpha;

  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
  };
}

function createBiquadHighpass(cutoff: number, sampleRate: number) {
  const w0 = (2 * Math.PI * cutoff) / sampleRate;
  const alpha = Math.sin(w0) / (2 * Math.SQRT2);
  const cosw0 = Math.cos(w0);

  const b0 = (1 + cosw0) / 2;
  const b1 = -(1 + cosw0);
  const b2 = (1 + cosw0) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosw0;
  const a2 = 1 - alpha;

  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
  };
}

/**
 * Applies a biquad filter forward and backward to eliminate phase distortion (zero-phase filtering).
 */
function applyBiquadFilter(input: Float32Array, coeffs: { b0: number; b1: number; b2: number; a1: number; a2: number }): Float32Array {
  const len = input.length;
  const output = new Float32Array(len);
  const { b0, b1, b2, a1, a2 } = coeffs;

  // Forward pass
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < len; i++) {
    const x0 = input[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    output[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }

  // Backward pass for linear phase
  x1 = 0; x2 = 0; y1 = 0; y2 = 0;
  for (let i = len - 1; i >= 0; i--) {
    const x0 = output[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    output[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }

  return output;
}

/**
 * Process an AudioBuffer to produce instrumental or isolated vocals using Mid-Side Crossover DSP.
 */
export function processAudioBuffer(
  inputBuffer: AudioBuffer,
  audioCtx: AudioContext | OfflineAudioContext,
  params: DspParameters
): AudioBuffer {
  const sampleRate = inputBuffer.sampleRate;
  const numChannels = inputBuffer.numberOfChannels;
  const length = inputBuffer.length;

  const leftChannel = inputBuffer.getChannelData(0);
  const rightChannel = numChannels > 1 ? inputBuffer.getChannelData(1) : leftChannel;

  // Create destination buffer (stereo)
  const outputBuffer = audioCtx.createBuffer(2, length, sampleRate);
  const outL = outputBuffer.getChannelData(0);
  const outR = outputBuffer.getChannelData(1);

  if (params.mode === 'original') {
    outL.set(leftChannel);
    outR.set(rightChannel);
    return outputBuffer;
  }

  // Calculate Mid and Side channels
  // Mid = (L + R) / 2
  // Side = (L - R) / 2
  const mid = new Float32Array(length);
  const side = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const l = leftChannel[i];
    const r = rightChannel[i];
    mid[i] = (l + r) * 0.5;
    side[i] = (l - r) * 0.5;
  }

  // Design Crossover filters for the Mid channel:
  // Lowpass filter for Bass preservation (kick + bassline reside below ~180Hz)
  const lowCoeffs = createBiquadLowpass(params.vocalLowFreq, sampleRate);
  const midBass = applyBiquadFilter(mid, lowCoeffs);

  // Highpass filter for High Air / cymbals preservation (above ~4500Hz)
  const highCoeffs = createBiquadHighpass(params.vocalHighFreq, sampleRate);
  const midHigh = applyBiquadFilter(mid, highCoeffs);

  // Vocal band Mid = total Mid - bass Mid - high Mid
  const midVocal = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    midVocal[i] = mid[i] - midBass[i] - midHigh[i];
  }

  const vocalReductionFactor = params.mode === 'instrumental' ? 1.0 : params.vocalCut;
  const vocalRetention = Math.max(0, 1.0 - vocalReductionFactor);
  const bassPreserve = params.bassPreserve;
  const stereoWidth = params.stereoWidth;
  const gain = params.gain;

  if (params.mode === 'vocal_isolated') {
    // Isolated vocals: Extract the center vocal band plus attenuated remnants
    for (let i = 0; i < length; i++) {
      const vocalSample = midVocal[i] * gain * 1.35;
      outL[i] = vocalSample;
      outR[i] = vocalSample;
    }
    return outputBuffer;
  }

  // Instrumental / Custom synthesis:
  // Reconstruction:
  // Left = (Mid_bass * bassPreserve) + (Mid_vocal * vocalRetention) + (Mid_high) + (Side * stereoWidth)
  // Right = (Mid_bass * bassPreserve) + (Mid_vocal * vocalRetention) + (Mid_high) - (Side * stereoWidth)
  for (let i = 0; i < length; i++) {
    const centerRemaining =
      midBass[i] * bassPreserve +
      midVocal[i] * vocalRetention +
      midHigh[i];

    const stereoSide = side[i] * stereoWidth;

    // Output with gain
    let sampleL = (centerRemaining + stereoSide) * gain;
    let sampleR = (centerRemaining - stereoSide) * gain;

    // Soft clipping limiter
    if (sampleL > 0.98) sampleL = 0.98 + (sampleL - 0.98) * 0.1;
    else if (sampleL < -0.98) sampleL = -0.98 + (sampleL + 0.98) * 0.1;

    if (sampleR > 0.98) sampleR = 0.98 + (sampleR - 0.98) * 0.1;
    else if (sampleR < -0.98) sampleR = -0.98 + (sampleR + 0.98) * 0.1;

    outL[i] = sampleL;
    outR[i] = sampleR;
  }

  return outputBuffer;
}

/**
 * Encode an AudioBuffer into standard 16-bit PCM stereo WAV format.
 */
export function encodeAudioBufferToWav(audioBuffer: AudioBuffer): Blob {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const left = audioBuffer.getChannelData(0);
  const right = numChannels > 1 ? audioBuffer.getChannelData(1) : left;
  const length = left.length;

  const buffer = new ArrayBuffer(44 + length * blockAlign);
  const view = new DataView(buffer);

  // Helper to write ASCII strings
  function writeString(offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // RIFF header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * blockAlign, true);
  writeString(8, 'WAVE');

  // fmt subchunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data subchunk
  writeString(36, 'data');
  view.setUint32(40, length * blockAlign, true);

  // Write interleaved 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < length; i++) {
    // Left channel
    let sampleL = left[i];
    sampleL = Math.max(-1, Math.min(1, sampleL));
    const intSampleL = sampleL < 0 ? sampleL * 0x8000 : sampleL * 0x7fff;
    view.setInt16(offset, intSampleL, true);
    offset += 2;

    // Right channel
    if (numChannels > 1) {
      let sampleR = right[i];
      sampleR = Math.max(-1, Math.min(1, sampleR));
      const intSampleR = sampleR < 0 ? sampleR * 0x8000 : sampleR * 0x7fff;
      view.setInt16(offset, intSampleR, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Generates an instrumental + vocal song using Web Audio synthesis for instantaneous testing
 * without requiring the user to have an audio file ready.
 */
export function generateSyntheticDemoSong(audioCtx: AudioContext, type: 'pop_funk' | 'synthwave'): AudioBuffer {
  const sampleRate = audioCtx.sampleRate;
  const bpm = type === 'pop_funk' ? 120 : 108;
  const beatDuration = 60 / bpm;
  const totalBars = 8;
  const totalDuration = totalBars * 4 * beatDuration; // ~16 or 17.7 seconds loopable
  const totalSamples = Math.floor(sampleRate * totalDuration);

  const buffer = audioCtx.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Scale frequencies (C pentatonic / minor)
  const notes = {
    C3: 130.81,
    Eb3: 155.56,
    F3: 174.61,
    G3: 196.00,
    Bb3: 233.08,
    C4: 261.63,
    D4: 293.66,
    Eb4: 311.13,
    F4: 349.23,
    G4: 392.00,
    Bb4: 466.16,
    C5: 523.25,
  };

  const melodyNotes = [
    notes.C4, notes.Eb4, notes.F4, notes.G4,
    notes.Bb4, notes.G4, notes.F4, notes.Eb4,
    notes.C4, notes.D4, notes.Eb4, notes.G4,
    notes.F4, notes.Eb4, notes.D4, notes.C4,
  ];

  const bassNotes = [
    notes.C3, notes.C3, notes.Eb3, notes.F3,
    notes.G3, notes.G3, notes.Bb3, notes.C4,
  ];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const beat = t / beatDuration;
    const bar = Math.floor(beat / 4);
    const beatInBar = beat % 4;

    // 1. Kick Drum (Dead Center, low frequency sine sweep 140Hz -> 45Hz on beats 0, 1, 2, 3)
    const kickTime = beat % 1;
    let kick = 0;
    if (kickTime < 0.25) {
      const freq = 140 * Math.exp(-kickTime * 22) + 45;
      const env = Math.exp(-kickTime * 14);
      kick = Math.sin(2 * Math.PI * freq * kickTime) * env * 0.45;
    }

    // 2. Bassline (Dead Center, filtered saw wave)
    const bassNoteIdx = Math.floor(beat * 2) % bassNotes.length;
    const bassFreq = bassNotes[bassNoteIdx];
    const bassSubBeat = (beat * 2) % 1;
    const bassEnv = Math.exp(-bassSubBeat * 4);
    // Sawtooth wave synthesis
    const bassPhase = (t * bassFreq) % 1;
    const bassSaw = (bassPhase - 0.5) * 2;
    const bass = bassSaw * bassEnv * 0.25;

    // 3. Stereo Rhythm Chords (PANNED HARD LEFT AND RIGHT - Stereo instrumentation)
    // Left channel rhythm guitar/synth, Right channel rhodes/arpeggio
    const chordTime = beat % 2;
    const chordEnv = Math.exp(-chordTime * 2.5);
    const chordFreq1 = type === 'pop_funk' ? notes.Eb4 : notes.G4;
    const chordFreq2 = type === 'pop_funk' ? notes.Bb4 : notes.C5;
    const stereoL_inst = (Math.sin(2 * Math.PI * chordFreq1 * t) * 0.15 + (Math.sin(2 * Math.PI * (chordFreq1 * 1.5) * t) * 0.08)) * chordEnv;
    const stereoR_inst = (Math.sin(2 * Math.PI * chordFreq2 * t) * 0.15 + (Math.cos(2 * Math.PI * (chordFreq2 * 0.75) * t) * 0.08)) * chordEnv;

    // 4. Stereo Hi-Hats / Shakers (Stereo wide noise)
    const hatTime = (beat * 2) % 1;
    let hat = 0;
    if (hatTime < 0.06) {
      hat = (Math.random() * 2 - 1) * Math.exp(-hatTime * 60) * 0.12;
    }

    // 5. VOCAL LEAD / CANTANTE (DEAD CENTER phantom mono mix!)
    // Formant rich vocal-like wave with vibrato in the 300Hz-2500Hz range
    const melodyIdx = Math.floor(beat * 2) % melodyNotes.length;
    const targetFreq = melodyNotes[melodyIdx];
    const vibrato = 1 + 0.02 * Math.sin(2 * Math.PI * 5.5 * t);
    const vocalPitch = targetFreq * vibrato;
    const vocalSubBeat = (beat * 2) % 1;
    const vocalEnv = Math.sin(Math.min(Math.PI, vocalSubBeat * Math.PI * 1.1)) * 0.8;
    
    // Vocal harmonic synthesis with formants (ah / oh sound)
    const vocalP1 = Math.sin(2 * Math.PI * vocalPitch * t);
    const vocalP2 = Math.sin(2 * Math.PI * (vocalPitch * 2) * t) * 0.5;
    const vocalP3 = Math.sin(2 * Math.PI * (vocalPitch * 3) * t) * 0.25;
    const vocalLead = (vocalP1 + vocalP2 + vocalP3) * vocalEnv * 0.35;

    // Mixdown:
    // Left = Kick(center) + Bass(center) + StereoL_inst + Hat*0.7 + VocalLead(center)
    // Right = Kick(center) + Bass(center) + StereoR_inst - Hat*0.7 + VocalLead(center)
    left[i] = kick + bass + stereoL_inst + (hat * 0.8) + vocalLead;
    right[i] = kick + bass + stereoR_inst - (hat * 0.8) + vocalLead;
  }

  return buffer;
}
