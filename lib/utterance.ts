/** End a spoken turn after a pause, without sending idle room audio. */
export class UtteranceDetector {
  private started: number;
  private previous: number;
  private lastVoice: number;
  private voiced = 0;
  constructor(now: number) {
    this.started = this.previous = this.lastVoice = now;
  }
  sample(rms: number, now: number): 'send' | 'discard' | null {
    const delta = Math.min(100, Math.max(0, now - this.previous));
    this.previous = now;
    if (rms >= 0.018) {
      this.voiced += delta;
      this.lastVoice = now;
    }
    const hasSpeech = this.voiced >= 200;
    if (hasSpeech && now - this.lastVoice >= 1200) return 'send';
    if (now - this.started >= 20000) return hasSpeech ? 'send' : 'discard';
    if (!hasSpeech && now - this.started >= 8000) return 'discard';
    return null;
  }
}
