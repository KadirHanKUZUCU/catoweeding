import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const KEY_RE =
  /^[0-9a-f-]{36}\/[A-Za-z0-9_-]+\/(photo\.(jpg|jpeg|png|webp)|video\.(mp4|webm|mov|m4v))$/i;

function r2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 ortam değişkenleri eksik.");
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = (await request.json()) as { key?: string; contentType?: string };
    const key = body.key?.trim() ?? "";
    const contentType = body.contentType?.trim() ?? "application/octet-stream";

    if (!KEY_RE.test(key)) {
      return new Response("Geçersiz dosya yolu.", { status: 400 });
    }
    if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
      return new Response("Yalnızca görsel veya video.", { status: 400 });
    }

    const bucket = process.env.R2_BUCKET_NAME;
    if (!bucket) return new Response("R2 bucket tanımlı değil.", { status: 500 });

    const client = r2Client();
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
      { expiresIn: 600 },
    );

    return Response.json({ uploadUrl, key });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Presign hatası.";
    return new Response(msg, { status: 500 });
  }
}
