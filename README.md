# あきかん — AI Image Studio

白×青の画像生成・画像編集AIサイトです。文章から画像を生成するほか、画像を1枚添付して編集・参照生成できます。

## Renderで公開する方法（スマホからURLでアクセス可能）
1. GitHubに新しいリポジトリ `akikan-ai-site` を作成します。
2. このフォルダの中身をGitHubリポジトリへアップロードします（`.env` やAPIキーは絶対にアップロードしない）。
3. Renderにログインし、New → Web Service → GitHubリポジトリ `akikan-ai-site` を選択します。
4. `render.yaml` の設定を使うか、Build Commandを `npm install`、Start Commandを `npm start` にします。
5. RenderのEnvironmentで `OPENAI_API_KEY` を追加し、OpenAI APIキーを設定します。キーはRenderのSecret欄にだけ入力します。
6. Create Web Service / Deployを押し、デプロイ完了後に表示される `https://....onrender.com` をスマホで開きます。

## ローカル起動
1. Node.js 20以上を用意
2. `npm install`
3. `.env.example` を `.env` にコピーし、`OPENAI_API_KEY` にAPIキーを設定
4. `npm start`
5. `http://localhost:3000` を開く

画像添付はPNG/JPG/WEBP、1枚20MBまで。画像編集はOpenAI Images APIの `/v1/images/edits` を使用します。画像生成・編集にはAPI利用枠と料金が必要です。APIキーをHTMLやpublicフォルダ、GitHubへ置かず、Renderの環境変数（Secret）として登録してください。

RenderのFreeプランは一定時間アクセスがないとスリープする場合があり、次のアクセス時に起動待ちが発生します。画像生成APIの利用料金はホスティング料金とは別です。

参考：
- Render Node/Expressデプロイ: https://render.com/docs/deploy-node-express-app
- Render Web Services: https://render.com/docs/web-services
- OpenAI Image Generation: https://developers.openai.com/api/docs/guides/image-generation
