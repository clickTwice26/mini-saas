// Silent No-Op Sound Service (All sound effects removed)
class SoundService {
  public toggleMute(): boolean {
    return true;
  }

  public getIsMuted(): boolean {
    return true;
  }

  public playSent() {}
  public playReceived() {}
  public playPeerJoined() {}
  public playPeerLeft() {}
  public playNuke() {}
}

export const soundService = new SoundService();
