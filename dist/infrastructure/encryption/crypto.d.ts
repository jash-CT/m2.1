export declare class EncryptionService {
    private key;
    constructor(key: Buffer);
    encrypt(plaintext: string): Buffer;
    decrypt(ciphertext: Buffer): string;
}
//# sourceMappingURL=crypto.d.ts.map