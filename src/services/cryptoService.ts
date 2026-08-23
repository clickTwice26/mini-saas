// Web Crypto API - Zero-Knowledge Hardware-Grade AES-GCM-256 End-to-End Encryption
class CryptoService {
  private cryptoKey: CryptoKey | null = null;
  private currentSecretKey: string = '';
  private safetyFingerprint: string = '';

  // Generate a cryptographically secure 256-bit random key (Base64URL encoded)
  public generateSecureKey(): string {
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    let binary = '';
    for (let i = 0; i < randomBytes.byteLength; i++) {
      binary += String.fromCharCode(randomBytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  // Derive a 256-bit AES-GCM CryptoKey from the shared Secret Key Token
  public async setSecretKey(secretKey: string) {
    this.currentSecretKey = secretKey.trim();
    const encoder = new TextEncoder();
    const secretBytes = encoder.encode(this.currentSecretKey);

    // 1. Generate SHA-256 Hash of Secret Key Token
    const hashBuffer = await crypto.subtle.digest('SHA-256', secretBytes);

    // 2. Import as AES-GCM Key
    this.cryptoKey = await crypto.subtle.importKey(
      'raw',
      hashBuffer,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    // 3. Compute 16-character Visual Safety Number / Fingerprint
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    this.safetyFingerprint = `${hex.slice(0, 4)} ${hex.slice(4, 8)} ${hex.slice(8, 12)} ${hex.slice(12, 16)}`.toUpperCase();
  }

  public getSecretKey(): string {
    return this.currentSecretKey;
  }

  public getSafetyFingerprint(): string {
    return this.safetyFingerprint;
  }

  // Encrypt JSON-serializable payload into AES-GCM-256 ciphertext with 12-byte random IV
  public async encrypt(data: unknown): Promise<{ iv: string; ciphertext: string }> {
    if (!this.cryptoKey) {
      throw new Error('Encryption key not initialized');
    }

    const encoder = new TextEncoder();
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
    const plainBytes = encoder.encode(jsonStr);

    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      this.cryptoKey,
      plainBytes
    );

    const ivBase64 = btoa(String.fromCharCode(...iv));
    const cipherBytes = new Uint8Array(encryptedBuffer);
    let cipherBinary = '';
    for (let i = 0; i < cipherBytes.length; i++) {
      cipherBinary += String.fromCharCode(cipherBytes[i]);
    }
    const cipherBase64 = btoa(cipherBinary);

    return {
      iv: ivBase64,
      ciphertext: cipherBase64
    };
  }

  // Decrypt AES-GCM-256 ciphertext back into original object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async decrypt(encryptedPayload: { iv: string; ciphertext: string }): Promise<any> {
    if (!this.cryptoKey) {
      throw new Error('Encryption key not initialized');
    }

    const ivStr = atob(encryptedPayload.iv);
    const iv = new Uint8Array(ivStr.length);
    for (let i = 0; i < ivStr.length; i++) {
      iv[i] = ivStr.charCodeAt(i);
    }

    const cipherStr = atob(encryptedPayload.ciphertext);
    const cipherBytes = new Uint8Array(cipherStr.length);
    for (let i = 0; i < cipherStr.length; i++) {
      cipherBytes[i] = cipherStr.charCodeAt(i);
    }

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      this.cryptoKey,
      cipherBytes
    );

    const decoder = new TextDecoder();
    const jsonStr = decoder.decode(decryptedBuffer);

    try {
      return JSON.parse(jsonStr);
    } catch {
      return jsonStr;
    }
  }
}

export const cryptoService = new CryptoService();
