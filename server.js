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
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const passport = require("passport");
const expressLayouts = require("express-ejs-layouts");

// 環境変数のロード
dotenv.config();

// データベース接続
const connectDB = require("./config/database");

// アプリケーション初期化
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Passport設定
require("./config/passport")(passport);

// EJSの設定
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layouts/main");

// ミドルウェア
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// セッション設定
app.use(
    session({
        secret: process.env.SESSION_SECRET || "your_session_secret",
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: process.env.MONGODB_URI,
        }),
        cookie: {
            maxAge: 1000 * 60 * 60 * 24, // 1日
        },
    })
);

// Passport初期化
app.use(passport.initialize());
app.use(passport.session());

// 定数
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

// 一時ディレクトリの作成
async function ensureTempDir() {
    try {
        await fs.mkdir(TEMP_DIR, { recursive: true });
        console.log(`Temporary directory created at: ${TEMP_DIR}`);
    } catch (err) {
        console.error("Error creating temporary directory:", err);
    }
}

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

// APIルート（先に処理する）
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

// WebSocketの設定
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

// 認証ルートの設定
if (process.env.SKIP_DB !== "true") {
    app.use("/", require("./routes/auth"));
    app.use("/admin", require("./routes/admin"));
    app.use("/", require("./routes/index"));
} else {
    // 認証なしの場合の直接ルート
    app.get("/", (req, res) => {
        res.render("editor", {
            title: "Markwhen Editor",
            user: { username: "ゲスト", isAdmin: true },
            layout: "layouts/main",
        });
    });
}

// スタティックファイルの提供は最後に（一般的なパターン）
app.use(express.static(path.join(__dirname, "public")));

// API routes for document operations
app.use("/api/documents", require("./routes/documents"));

// 既存のルート設定は維持
app.use("/", require("./routes/index"));
app.use("/", require("./routes/auth"));
app.use("/admin", require("./routes/admin"));

// Start the server
async function startServer() {
    try {
        // データベース接続
        await connectDB();

        // テンポラリディレクトリの確認
        await ensureTempDir();

        // サンプルファイルの確認
        await createExampleFileIfNotExists();

        // CSSファイルの確認と作成
        const authCssPath = path.join(PUBLIC_DIR, "css", "auth.css");
        const adminCssPath = path.join(PUBLIC_DIR, "css", "admin.css");

        try {
            await fs.access(authCssPath);
            console.log("既存のauth.cssファイルを使用します");
        } catch {
            // auth.cssが存在しない場合は作成
            await fs.writeFile(
                authCssPath,
                `
/* 認証関連のスタイル */
.auth-body {
  background-color: #f5f5f5;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.auth-nav {
  background-color: #4285f4;
  color: white;
  padding: 1rem;
  text-align: center;
}

.auth-logo h1 {
  margin: 0;
  font-size: 24px;
}

.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
  padding: 2rem;
}

.auth-form-container {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  width: 100%;
  max-width: 500px;
}

.auth-header {
  margin-bottom: 2rem;
  text-align: center;
}

.auth-form .form-group {
  margin-bottom: 1.5rem;
}

.auth-form label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.auth-form input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

.auth-form .form-actions {
  margin-top: 2rem;
  text-align: center;
}

.auth-form .btn {
  min-width: 120px;
}

.auth-footer {
  margin-top: 1.5rem;
  text-align: center;
  color: #666;
}

.alert {
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1.5rem;
}

.alert-danger {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.alert-success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}
`
            );
            console.log("auth.cssを作成しました");
        }

        try {
            await fs.access(adminCssPath);
            console.log("既存のadmin.cssファイルを使用します");
        } catch {
            // admin.cssが存在しない場合は作成
            await fs.writeFile(
                adminCssPath,
                `
/* 管理画面のスタイル */
.header-nav {
  background-color: #4285f4;
  color: white;
  padding: 0 1rem;
  height: 60px;
  display: flex;
  align-items: center;
}

.nav-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.logo a {
  color: white;
  text-decoration: none;
  font-size: 1.5rem;
  font-weight: bold;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.dropdown {
  position: relative;
  display: inline-block;
}

.dropbtn {
  background-color: #3376e6;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.dropdown-content {
  display: none;
  position: absolute;
  right: 0;
  background-color: #f9f9f9;
  min-width: 160px;
  box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
  z-index: 1;
  border-radius: 4px;
}

.dropdown-content a {
  color: black;
  padding: 12px 16px;
  text-decoration: none;
  display: block;
}

.dropdown-content a:hover {
  background-color: #f1f1f1;
}

.dropdown:hover .dropdown-content {
  display: block;
}

.dropdown:hover .dropbtn {
  background-color: #2859b8;
}

.dropdown-divider {
  height: 1px;
  background-color: #e0e0e0;
  margin: 0.5rem 0;
}

/* 管理パネルのスタイル */
.admin-container {
  display: flex;
  min-height: calc(100vh - 60px);
}

.admin-sidebar {
  width: 250px;
  background-color: #f8f9fa;
  border-right: 1px solid #e0e0e0;
  padding: 1.5rem 1rem;
}

.admin-sidebar h3 {
  margin-bottom: 1rem;
  color: #333;
}

.admin-sidebar ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.admin-sidebar li {
  margin-bottom: 0.5rem;
}

.admin-sidebar a {
  display: block;
  padding: 0.75rem 1rem;
  color: #333;
  text-decoration: none;
  border-radius: 4px;
}

.admin-sidebar a:hover {
  background-color: #eee;
}

.admin-sidebar li.active a {
  background-color: #4285f4;
  color: white;
}

.admin-content {
  flex: 1;
  padding: 2rem;
}

.admin-content h1 {
  margin-bottom: 2rem;
  color: #333;
}

.admin-panel {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e0e0e0;
}

.panel-header h2 {
  margin: 0;
  color: #333;
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
}

.admin-table th,
.admin-table td {
  padding: 1rem 1.5rem;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
}

.admin-table th {
  font-weight: 600;
  color: #666;
  background-color: #f9f9f9;
}

.admin-table tr:last-child td {
  border-bottom: none;
}

.admin-table .actions {
  display: flex;
  gap: 0.5rem;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
}

.btn-info {
  background-color: #17a2b8;
}

.btn-info:hover {
  background-color: #138496;
}

.btn-danger {
  background-color: #dc3545;
}

.btn-danger:hover {
  background-color: #c82333;
}

.btn-secondary {
  background-color: #6c757d;
}

.btn-secondary:hover {
  background-color: #5a6268;
}

.delete-form {
  display: inline;
}

.form {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

.form-group input:disabled {
  background-color: #f9f9f9;
}

.form-group small {
  display: block;
  margin-top: 0.25rem;
  color: #666;
}

.radio-group {
  margin-top: 0.5rem;
}

.radio-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: normal;
}

.form-actions {
  margin-top: 2rem;
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

.no-data {
  padding: 3rem;
  text-align: center;
  color: #666;
}

/* プロフィールページのスタイル */
.profile-container {
  max-width: 800px;
  margin: 2rem auto;
  padding: 0 1rem;
}

.profile-header {
  margin-bottom: 2rem;
}

.profile-content {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 2rem;
}

.profile-form .form-section {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e0e0e0;
}

.profile-form .form-section h3 {
  margin-bottom: 1.5rem;
  color: #333;
}

/* エラーページのスタイル */
.error-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 60px);
  padding: 2rem;
}

.error-content {
  text-align: center;
  max-width: 600px;
}

.error-message {
  margin: 2rem 0;
}

.error-actions {
  margin-top: 2rem;
}
`
            );
            console.log("admin.cssを作成しました");
        }

        // サーバー起動
        server.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("サーバー起動エラー:", error);
        process.exit(1);
    }
}

startServer();
