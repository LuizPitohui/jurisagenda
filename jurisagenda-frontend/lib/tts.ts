/**
 * TTS via backend — chama /api/v1/tv/tts/?text=...
 * O backend usa Google Cloud TTS Wavenet pt-BR.
 */

let currentAudio: HTMLAudioElement | null = null;

export async function speakGoogleTTS(
  text: string,
  onStart?: () => void,
  onEnd?: () => void
): Promise<void> {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  try {
    const url = `/api/v1/tv/tts/?text=${encodeURIComponent(text)}`;
    const res = await fetch(url);

    if (!res.ok) throw new Error(`TTS error ${res.status}`);

    const blob = await res.blob();
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    currentAudio = audio;

    onStart?.();
    await audio.play();
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
      onEnd?.();
    };
  } catch (err) {
    console.error('Google TTS falhou, usando fallback:', err);
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'pt-BR';
      utter.rate = 0.9;
      onStart?.();
      utter.onend = () => onEnd?.();
      window.speechSynthesis.speak(utter);
    }
  }
}
