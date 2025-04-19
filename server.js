// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs").promises;
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);
const os = require("os");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const TEMP_DIR = path.join(os.tmpdir(), "markwhen-editor");
const PUBLIC_DIR = path.join(__dirname, "public");

// example.mwの内容はサーバーには保存せず、クライアント側で提供
const EXAMPLE_CONTENT = `# プロジェクト管理サンプル

title: マークウェンプロジェクト管理ツール

section プロジェクト計画
  2023-10-01: プロジェクト開始 #マイルストーン
    キックオフミーティングを開催
    - [x] プロジェクト憲章の作成
    - [x] ステークホルダー分析
    @本社会議室

  2023-10-02 -> 2023-10-15: 要件定義 #計画
    - [x] ビジネス要件の収集
    - [x] ユーザーインタビュー
    - [x] 機能要件の文書化
    @リサーチセンター

  2023-10-16 -> 2023-11-15: 設計フェーズ #設計
    - [x] システムアーキテクチャの設計
    - [x] データベース設計
    - [x] UI/UX設計
    チームメンバー: 山田、佐藤、鈴木
    @開発センター

section 開発期間
  2023-11-16 -> 2024-01-15: 開発フェーズ #開発
    - [x] フロントエンド開発
    - [x] バックエンド開発
    - [x] データベース実装
    - [x] APIの開発
    チームメンバー: 全開発チーム
    @開発センター

  2024-01-16 -> 2024-02-15: テストフェーズ #テスト
    - [x] 単体テスト
    - [x] 統合テスト
    - [x] システムテスト
    - [x] ユーザー受け入れテスト
    テストチーム: 田中、伊藤
    @テストラボ

  2024-02-16 -> 2024-02-28: バグ修正 #開発
    テスト中に発見された問題の修正
    重大度の高い不具合: 5件
    すべての重大な不具合を修正完了
    @開発センター

section リリースと運用
  2024-03-01: 製品リリース #マイルストーン
    バージョン1.0の公開
    - [x] 本番環境へのデプロイ
    - [x] リリースノートの作成
    - [x] サポートチームへの引き継ぎ
    @データセンター

  2024-03-02 -> 2024-03-15: 初期サポート期間 #サポート
    - [x] ユーザーからのフィードバック収集
    - [x] 小規模な修正のリリース
    - [x] パフォーマンスモニタリング
    @カスタマーサポートセンター

  2024-03-16 -> now: 継続的改善 #開発 #サポート
    - [ ] 新機能の計画
    - [ ] パフォーマンス最適化
    - [ ] セキュリティアップデート
    @本社
`;

// Ensure temporary directory exists
async function ensureTempDir() {
    try {
        await fs.mkdir(TEMP_DIR, { recursive: true });
        console.log(`Temporary directory created at: ${TEMP_DIR}`);
    } catch (err) {
        console.error("Error creating temporary directory:", err);
    }
}

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// example.mwファイルを生成する関数（初回起動時のみ実行）
async function createExampleFileIfNotExists() {
    try {
        const examplePath = path.join(PUBLIC_DIR, "example.mw");

        // ファイルが存在するか確認
        try {
            await fs.access(examplePath);
            console.log("既存のexample.mwファイルを使用します");
        } catch {
            // 存在しない場合は作成
            await fs.writeFile(examplePath, EXAMPLE_CONTENT, "utf8");
            console.log("example.mwファイルを作成しました");
        }
    } catch (error) {
        console.error(
            "example.mwファイルの処理中にエラーが発生しました:",
            error
        );
    }
}

// Route to generate the preview using markwhen CLI
app.post("/api/preview", async (req, res) => {
    try {
        const { content, viewType = "timeline" } = req.body;

        await ensureTempDir();
        const inputFilePath = path.join(TEMP_DIR, "temp-input.mw");
        const outputFilePath = path.join(
            TEMP_DIR,
            `temp-output-${viewType}.html`
        );

        // Write the content to a temporary file
        await fs.writeFile(inputFilePath, content, "utf8");

        // Execute markwhen CLI command
        const command = `mw ${inputFilePath} ${outputFilePath} -o ${viewType}`;
        await execAsync(command);

        // Read the generated HTML file
        const html = await fs.readFile(outputFilePath, "utf8");

        res.json({ success: true, html });
    } catch (error) {
        console.error("Error generating preview:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// WebSocket connection for real-time updates
io.on("connection", (socket) => {
    console.log("Client connected");

    socket.on("content-changed", async (data) => {
        try {
            const { content, viewType = "timeline" } = data;

            await ensureTempDir();
            const inputFilePath = path.join(TEMP_DIR, "temp-input.mw");
            const outputFilePath = path.join(
                TEMP_DIR,
                `temp-output-${viewType}.html`
            );

            // Markwhenファイルからタイトルを抽出
            const title = extractTitle(content) || "Markwhen";

            // Write the content to a temporary file
            await fs.writeFile(inputFilePath, content, "utf8");

            // Execute markwhen CLI command with the specified view type
            const command = `mw ${inputFilePath} ${outputFilePath} -o ${viewType}`;
            await execAsync(command);

            // Read the generated HTML file
            const html = await fs.readFile(outputFilePath, "utf8");

            // Send the HTML back to the client along with the title
            socket.emit("preview-updated", {
                html,
                title,
            });
        } catch (error) {
            console.error("Error generating preview:", error);
            socket.emit("preview-error", { error: error.message });
        }
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected");
    });
});

// Markwhenファイルからタイトルを抽出する関数
function extractTitle(content) {
    // title: で始まる行を探す
    const titleMatch = content.match(/^title:\s*(.+)$/m);
    if (titleMatch && titleMatch[1]) {
        return titleMatch[1].trim();
    }

    // # で始まる最初の見出しを探す（代替）
    const headingMatch = content.match(/^#\s+(.+)$/m);
    if (headingMatch && headingMatch[1]) {
        return headingMatch[1].trim();
    }

    return null;
}

// Start the server
async function startServer() {
    await ensureTempDir();
    await createExampleFileIfNotExists();

    server.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}

startServer();
