import * as crypto from "crypto";

export class EncryptionUtil {
  private static getMasterKey(): Buffer {
    const rawKey = process.env.MASTER_KEY || "dev-master-key-change-in-production-123456789";
    // Hash the master key using SHA-256 to ensure it is exactly 32 bytes (256 bits)
    return crypto.createHash("sha256").update(rawKey).digest();
  }

  /**
   * Encrypts a plain JSON object or string using AES-256-GCM.
   */
  public static encrypt(data: Record<string, any>): { encryptedData: string; iv: string; tag: string } {
    const key = this.getMasterKey();
    const iv = crypto.randomBytes(12); // 96-bit IV is recommended for GCM
    
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    
    const plainText = JSON.stringify(data);
    let encrypted = cipher.update(plainText, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    const tag = cipher.getAuthTag().toString("hex");

    return {
      encryptedData: encrypted,
      iv: iv.toString("hex"),
      tag,
    };
  }

  /**
   * Decrypts an AES-256-GCM payload back into a JSON object.
   */
  public static decrypt(encryptedData: string, ivHex: string, tagHex: string): Record<string, any> {
    const key = this.getMasterKey();
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return JSON.parse(decrypted);
  }
}
