import * as crypto from "crypto";

export class EncryptionUtil {
  private static getMasterKey(): Buffer {
    const rawKey = process.env.MASTER_KEY || "dev-master-key-change-in-production-123456789";
    return crypto.createHash("sha256").update(rawKey).digest();
  }

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
