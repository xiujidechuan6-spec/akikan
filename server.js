import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";

const app = express();
const PORT = process.env.PORT || 3000;

const MODEL = "@cf/black-forest-labs/flux-2-klein-4b";

const limiter = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 4 },
  fileFilter: (_req, file, cb) => {
    const ok = ["image/png", "image/jpeg", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("PNG・JPG・WEBP形式の画像を選んでください。"), ok);
  }
});

app.use(express.json({ limit: "2mb" }));

// 公開するファイルはpublicフォルダだけ
app.use(express.static("public"));

app.get("/health", (_req, res) =>
  res.json({ ok: true, app: "akikan" })
);

const styleGuide = {
  auto: "",
  photo: "Photorealistic photography, natural lighting, rich details. ",
  illustration: "Beautiful polished digital illustration. ",
  anime: "Japanese anime-inspired art, expressive and beautifully composed. ",
  watercolor: "Soft watercolor painting, delicate pigment texture. ",
  "3d": "High-quality 3D render, refined materials and studio lighting. "
};

function getPrompt(prompt, style) {
  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("画像の説明を入力してください。");
  }

  if (prompt.length > 4000) {
    throw new Error("説明文は4000文字以内にしてください。");
  }

  return `${styleGuide[style] ?? ""}${prompt.trim()}`;
}

function getDimensions(size) {
  const match = /^(\d{3,4})x(\d{3,4})$/.exec(size || "");

  if (!match) return { width: 1024, height: 1024 };

  const width = Math.min(1920, Math.max(256, Number(match[1])));
  const height = Math.min(1920, Math.max(256, Number(match[2])));

  return { width, height };
}

async function callCloudflare(form) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !token) {
    throw new Error("Cloudflareの設定が見つかりません。");
  }

  const url =
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: form
  });

  const raw = await response.text();

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("画像サービスから正しい応答を受け取れませんでした。");
  }

  if (!response.ok || data.success === false) {
    const message =
      data.errors?.[0]?.message ||
      data.error?.message ||
      "画像生成サービスでエラーが発生しました。";

    throw Object.assign(new Error(message), {
      status: response.status
    });
  }

  const image = data.result?.image;

  if (!image) {
    throw new Error("画像データを受け取れませんでした。");
  }

  return `data:image/png;base64,${image}`;
}

app.post("/api/generate", limiter, async (req, res) => {
  try {
    const prompt = getPrompt(req.body?.prompt, req.body?.style);
    const { width, height } = getDimensions(req.body?.size);

    const form = new FormData();
    form.append("prompt", prompt);
    form.append("width", String(width));
    form.append("height", String(height));

    const image = await callCloudflare(form);

    res.json({ image });
  } catch (e) {
    console.error("画像生成エラー:", e.message);
    res.status(e.status || 400).json({ error: e.message });
  }
});

app.post("/api/edit", limiter, upload.array("images", 4), async (req, res) => {
  try {
   if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        error: "編集したい画像を添付してください。"
      });
    }

    const prompt = getPrompt(req.body.prompt, req.body.style);
    const { width, height } = getDimensions(req.body.size);

    const form = new FormData();
    form.append("prompt", prompt);
    form.append("width", String(width));
    form.append("height", String(height));

    req.files.forEach((file, index) => {
  const imageBlob = new Blob([file.buffer], {
    type: file.mimetype
  });

  form.append(
    `input_image_${index}`,
    imageBlob,
    file.originalname || `reference${index}.png`
  );
});

    const image = await callCloudflare(form);

    res.json({ image });
  } catch (e) {
    console.error("画像編集エラー:", e.message);
    res.status(e.status || 400).json({ error: e.message });
  }
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: err.code === "LIMIT_FILE_SIZE"
        ? "画像は20MB以下にしてください。"
        : "画像の添付に失敗しました。"
    });
  }

  res.status(400).json({
    error: err.message || "リクエストに問題があります。"
  });
});

app.listen(PORT, () => {
  console.log(`あきかん: http://localhost:${PORT}`);
});
