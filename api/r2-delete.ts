import { DeleteObjectsCommand, S3Client } from "@aws-sdk/client-s3";

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
    const body = (await request.json()) as { keys?: string[] };
    const keys = (body.keys ?? []).filter((k) => KEY_RE.test(k));
    if (keys.length === 0) return Response.json({ deleted: 0 });

    const bucket = process.env.R2_BUCKET_NAME;
    if (!bucket) return new Response("R2 bucket tanımlı değil.", { status: 500 });

    const client = r2Client();
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: keys.map((Key) => ({ Key })) },
      }),
    );

    return Response.json({ deleted: keys.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Silme hatası.";
    return new Response(msg, { status: 500 });
  }
}
