import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";

const app = express();
const PORT = process.env.PORT || 3000;
const limiter = rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: "draft-7", legacyHeaders: false });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = ["image/png", "image/jpeg", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("PNG・JPG・WEBP形式の画像を選んでください。"), ok);
  }
});
app.use(express.json({ limit: "2mb" }));
app.use(express.static("public"));
app.get("/health", (_req, res) => res.json({ ok: true, app: "akikan" }));

const styleGuide = {
  auto: "", photo: "Photorealistic photography, natural lighting, rich details. ",
  illustration: "Beautiful polished digital illustration. ",
  anime: "Japanese anime-inspired art, expressive and beautifully composed. ",
  watercolor: "Soft watercolor painting, delicate pigment texture. ",
  "3d": "High-quality 3D render, refined materials and studio lighting. "
};

function getPrompt(prompt, style) {
  if (typeof prompt !== "string" || !prompt.trim()) throw new Error("画像の説明を入力してください。");
  if (prompt.length > 4000) throw new Error("説明文は4000文字以内にしてください。");
  return `${styleGuide[style] ?? ""}${prompt.trim()}`;
}

async function callImageApi(endpoint, body, isMultipart = false) {
  const response = await fetch(`https://api.openai.com/v1/images/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: isMultipart ? body : JSON.stringify(body),
    ...(isMultipart ? {} : { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" } })
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data?.error?.message || "画像APIでエラーが発生しました。"), { status: response.status });
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("画像データを受け取れませんでした。");
  return `data:image/png;base64,${b64}`;
}

app.post("/api/generate", limiter, async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: ".env に OPENAI_API_KEY を設定してください。" });
    const prompt = getPrompt(req.body?.prompt, req.body?.style);
    const image = await callImageApi("generations", {
      model: "gpt-image-2.5-flare", prompt,
      size: req.body.size || "1024x1024", quality: req.body.quality || "medium",
      output_format: "png", n: 1
    });
    res.json({ image });
  } catch (e) { res.status(e.status || 400).json({ error: e.message }); }
});

app.post("/api/edit", limiter, upload.single("image"), async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: ".env に OPENAI_API_KEY を設定してください。" });
    if (!req.file) return res.status(400).json({ error: "編集したい画像を添付してください。" });
    const prompt = getPrompt(req.body.prompt, req.body.style);
    const body = new FormData();
    body.append("model", "gpt-image-2.5-flare");
    body.append("prompt", prompt);
    body.append("size", req.body.size || "1024x1024");
    body.append("quality", req.body.quality || "medium");
    body.append("output_format", "png");
    body.append("image[]", new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname || "reference.png");
    const image = await callImageApi("edits", body, true);
    res.json({ image });
  } catch (e) { res.status(e.status || 400).json({ error: e.message }); }
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "画像は20MB以下にしてください。" : "画像の添付に失敗しました。" });
  res.status(400).json({ error: err.message || "リクエストに問題があります。" });
});

app.listen(PORT, () => console.log(`あきかん: http://localhost:${PORT}`));
