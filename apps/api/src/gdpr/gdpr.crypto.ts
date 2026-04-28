import {
  createCipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export type GdprEncryptedEnvelope = {
  version: 1;
  algorithm: "aes-256-gcm";
  iv: string;
  tag: string;
  ciphertext: string;
  checksum: string;
};

export type GdprDownloadTokenPayload = {
  requestId: string;
  artifactKey: string;
  expiresAt: string;
};

function deriveKey(secret: string) {
  return createHash("sha256").update(secret).digest();
}

export function encryptJsonEnvelope(
  payload: unknown,
  secret: string,
): GdprEncryptedEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const envelope: GdprEncryptedEnvelope = {
    version: 1,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    checksum: createHash("sha256")
      .update(ciphertext)
      .update(tag)
      .update(iv)
      .digest("hex"),
  };

  return envelope;
}

export function signDownloadToken(
  payload: GdprDownloadTokenPayload,
  secret: string,
) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

export function verifyDownloadToken(token: string, secret: string) {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    throw new Error("Download token is malformed.");
  }

  const expectedSignature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

  const expected = Buffer.from(expectedSignature, "utf8");
  const presented = Buffer.from(signature, "utf8");
  if (
    expected.length !== presented.length ||
    !timingSafeEqual(expected, presented)
  ) {
    throw new Error("Download token signature is invalid.");
  }

  return JSON.parse(
    Buffer.from(encodedPayload, "base64url").toString("utf8"),
  ) as GdprDownloadTokenPayload;
}
