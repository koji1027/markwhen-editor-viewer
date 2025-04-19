// Monaco Editorを利用したMarkwhenエディタとビューア実装
document.addEventListener("DOMContentLoaded", () => {
    initApplication();
});

// グローバル変数
let editor;
let socket;
let currentContent = "";
let debounceTimer;
const debounceDelay = 300; // プレビュー更新の遅延時間を300ミリ秒に設定（リアルタイム更新のため）

// アプリケーション初期化
async function initApplication() {
    // WebSocketの設定
    setupWebSocket();

    // Monaco Editorの初期化
    await initMonacoEditor();

    // イベントリスナーの設定
    setupEventListeners();

    // デフォルトコンテンツの読み込み
    loadDefaultContent();
}

// WebSocket接続の設定
function setupWebSocket() {
    socket = io();

    socket.on("connect", () => {
        updateStatus("サーバーに接続しました");
    });

    socket.on("disconnect", () => {
        updateStatus("サーバーから切断されました", "error");
    });

    socket.on("preview-updated", (data) => {
        updatePreviewFrame(data.html);
        updateStatus("プレビューが更新されました");
    });

    socket.on("preview-error", (data) => {
        updateStatus(`エラー: ${data.error}`, "error");
    });
}

// Monaco Editorの初期化
async function initMonacoEditor() {
    return new Promise((resolve) => {
        require.config({
            paths: {
                vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs",
            },
        });

        // Monaco Editorのロード
        require(["vs/editor/editor.main"], () => {
            // Markwhen用のカスタム言語定義
            defineMarkwhenLanguage();

            // エディタの作成
            createEditor();

            resolve();
        });
    });
}

// Markwhen用のカスタム言語定義
function defineMarkwhenLanguage() {
    // Markwhen言語の登録
    monaco.languages.register({ id: "markwhen" });

    // シンタックスハイライトのルール定義
    monaco.languages.setMonarchTokensProvider("markwhen", {
        tokenizer: {
            root: [
                // 日付（YYYY-MM-DD）
                [/\d{4}-\d{2}-\d{2}/, "date"],
                // 日付範囲の矢印
                [/->/, "arrow"],
                // タグ
                [/#[\w-]+/, "tag"],
                // タイトル（:の後ろ）
                [/:(.*)$/, "title"],
                // 見出し
                [/^#+ .*$/, "header"],
                // チェックリスト
                [/^\s*- \[ \]/, "checkbox.unchecked"],
                [/^\s*- \[x\]/, "checkbox.checked"],
                // リスト項目
                [/^\s*-/, "list.bullet"],
                // 場所（@で始まる）
                [/@[\w\s,]+/, "location"],
                // コメント
                [/\/\/.*$/, "comment"],
            ],
        },
    });

    // カスタムテーマの定義
    monaco.editor.defineTheme("markwhenTheme", {
        base: "vs",
        inherit: true,
        rules: [
            { token: "date", foreground: "0000FF", fontStyle: "bold" },
            { token: "arrow", foreground: "008800" },
            { token: "tag", foreground: "FF8C00" },
            { token: "title", foreground: "000000", fontStyle: "bold" },
            { token: "header", foreground: "800000", fontStyle: "bold" },
            { token: "checkbox.unchecked", foreground: "888888" },
            {
                token: "checkbox.checked",
                foreground: "008800",
                fontStyle: "bold",
            },
            { token: "list.bullet", foreground: "000088" },
            { token: "location", foreground: "008888", fontStyle: "italic" },
            { token: "comment", foreground: "008800", fontStyle: "italic" },
        ],
        colors: {
            "editor.foreground": "#000000",
            "editor.background": "#FFFFFF",
            "editor.lineHighlightBackground": "#F0F0F0",
            "editorCursor.foreground": "#666666",
            "editor.selectionBackground": "#ADD6FF",
            "editorLineNumber.foreground": "#999999",
            "editorLineNumber.activeForeground": "#333333",
        },
    });

    // コード補完プロバイダーの登録
    monaco.languages.registerCompletionItemProvider("markwhen", {
        provideCompletionItems: (model, position) => {
            const suggestions = [
                {
                    label: "date",
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: "${1:YYYY}-${2:MM}-${3:DD}",
                    insertTextRules:
                        monaco.languages.CompletionItemInsertTextRule
                            .InsertAsSnippet,
                    documentation: "日付を挿入します（YYYY-MM-DD形式）",
                },
                {
                    label: "daterange",
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText:
                        "${1:YYYY}-${2:MM}-${3:DD} -> ${4:YYYY}-${5:MM}-${6:DD}",
                    insertTextRules:
                        monaco.languages.CompletionItemInsertTextRule
                            .InsertAsSnippet,
                    documentation: "日付範囲を挿入します",
                },
                {
                    label: "event",
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText:
                        "${1:YYYY}-${2:MM}-${3:DD}: ${4:イベントタイトル}\n  ${5:イベントの詳細}",
                    insertTextRules:
                        monaco.languages.CompletionItemInsertTextRule
                            .InsertAsSnippet,
                    documentation: "基本的なイベントを挿入します",
                },
                {
                    label: "task",
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: "- [ ] ${1:タスク内容}",
                    insertTextRules:
                        monaco.languages.CompletionItemInsertTextRule
                            .InsertAsSnippet,
                    documentation: "未完了のタスクを挿入します",
                },
                {
                    label: "completed",
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: "- [x] ${1:完了したタスク}",
                    insertTextRules:
                        monaco.languages.CompletionItemInsertTextRule
                            .InsertAsSnippet,
                    documentation: "完了したタスクを挿入します",
                },
                {
                    label: "section",
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: "# ${1:セクションタイトル}",
                    insertTextRules:
                        monaco.languages.CompletionItemInsertTextRule
                            .InsertAsSnippet,
                    documentation: "セクション見出しを挿入します",
                },
                {
                    label: "tag",
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: "#${1:タグ名}",
                    insertTextRules:
                        monaco.languages.CompletionItemInsertTextRule
                            .InsertAsSnippet,
                    documentation: "タグを挿入します",
                },
                {
                    label: "location",
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: "@${1:場所}",
                    insertTextRules:
                        monaco.languages.CompletionItemInsertTextRule
                            .InsertAsSnippet,
                    documentation: "場所を挿入します",
                },
            ];

            return { suggestions: suggestions };
        },
    });

    // ホバー情報プロバイダーの登録
    monaco.languages.registerHoverProvider("markwhen", {
        provideHover: (model, position) => {
            const word = model.getWordAtPosition(position);
            if (!word) return null;

            const lineContent = model.getLineContent(position.lineNumber);

            // 日付にホバーした場合
            if (/\d{4}-\d{2}-\d{2}/.test(word.word)) {
                return {
                    contents: [
                        { value: "**日付形式**" },
                        {
                            value: "Markwhenでは様々な日付形式をサポートしています：\n- YYYY-MM-DD\n- MM/DD/YYYY\n- DD.MM.YYYY\n- 自然言語（例：today, yesterday, next week）",
                        },
                    ],
                };
            }

            // タグにホバーした場合
            if (word.word.startsWith("#")) {
                return {
                    contents: [
                        { value: "**タグ**" },
                        {
                            value: "タグを使用すると、イベントをカテゴリ分けできます。タイムライン上でフィルタリングにも使用できます。",
                        },
                    ],
                };
            }

            // 場所にホバーした場合
            if (word.word.startsWith("@")) {
                return {
                    contents: [
                        { value: "**場所**" },
                        {
                            value: "場所を指定すると、マップ上でイベントの位置を表示できます。",
                        },
                    ],
                };
            }

            return null;
        },
    });
}

// エディタのインスタンス作成
function createEditor() {
    const editorContainer = document.getElementById("monaco-editor");

    editor = monaco.editor.create(editorContainer, {
        value: "", // 初期値は空
        language: "markwhen", // カスタム言語を使用
        theme: "markwhenTheme", // カスタムテーマを使用
        automaticLayout: true, // コンテナサイズの変更に合わせて自動レイアウト
        fontSize: 14,
        lineNumbers: "on",
        renderLineHighlight: "all",
        scrollBeyondLastLine: false,
        minimap: {
            enabled: true,
        },
        folding: true,
        links: true,
        wordWrap: "on",
        lineDecorationsWidth: 10,
        lineNumbersMinChars: 3,
        renderIndentGuides: true,
        smoothScrolling: true,
        tabSize: 2,
        autoIndent: "full",
        formatOnType: true,
        formatOnPaste: true,
    });

    // エディター内容変更イベントのリスナー
    editor.onDidChangeModelContent(() => {
        updateStatus("編集中...");

        // プレビュー更新をデバウンス処理（より短い遅延時間で）
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            updatePreview();
        }, 300); // 遅延時間を300msに短縮して、よりリアルタイムな感覚にする
    });

    // カーソル位置変更イベントのリスナー
    editor.onDidChangeCursorPosition((e) => {
        const position = e.position;
        const model = editor.getModel();
        updateStatus(`行: ${position.lineNumber}, 列: ${position.column}`);
    });
}

// イベントリスナーのセットアップ
function setupEventListeners() {
    // 保存ボタンを非表示にするか、ラベルを変更
    const saveButton = document.getElementById("save-btn");
    if (saveButton) {
        saveButton.style.display = "none"; // 保存ボタンを非表示に
    }

    // サンプル読み込みボタン - example.mwファイルを読み込む
    document
        .getElementById("example-btn")
        .addEventListener("click", loadExampleFile);

    // ビュータイプ変更
    document
        .getElementById("view-type")
        .addEventListener("change", updatePreview);

    // ウィンドウリサイズ時のエディタサイズ調整
    window.addEventListener("resize", () => {
        if (editor) {
            editor.layout();
        }
    });
}

// デフォルトコンテンツの読み込み
function loadDefaultContent() {
    const defaultContent = `# マイタイムライン

2023-01-01: プロジェクト開始 #計画
  プロジェクトの詳細計画と要件定義を行いました
  - [ ] 要件定義書の作成
  - [x] ステークホルダーとの初回ミーティング
  @東京オフィス

2023-01-15 -> 2023-02-15: 設計フェーズ #設計
  主要な設計作業と技術選定
  - [x] アーキテクチャ設計
  - [x] データベース設計
  - [ ] UI/UXデザイン
  @大阪支社

2023-03-01: バージョン1.0リリース #リリース
  最初のバージョンを無事リリースしました！
  多くのユーザーからポジティブなフィードバックを受けています
  @オンライン

// これはMarkwhenコメントです
2023-04-15 -> 2023-05-30: 機能強化 #開発
  ユーザーフィードバックに基づく改善と新機能の追加
  - [ ] 検索機能の強化
  - [ ] モバイル対応の改善
  - [ ] パフォーマンス最適化
`;

    // エディタにコンテンツをセット
    editor.setValue(defaultContent);

    // 初期プレビューの更新
    updatePreview();
}

// このメソッドは不要になりました - loadExampleFileに置き換えられました

// プレビューの更新
function updatePreview() {
    const content = editor.getValue();
    const viewType = document.getElementById("view-type").value;

    updateStatus("プレビュー更新中...");

    // 毎回更新するように変更（currentContentとの比較を削除）
    currentContent = content;

    // WebSocketを通じてサーバーに内容を送信
    socket.emit("content-changed", {
        content: content,
        viewType: viewType,
    });
}

// プレビューフレームの更新
function updatePreviewFrame(html) {
    const previewFrame = document.getElementById("preview-frame");

    // iframeのコンテンツを設定
    if (previewFrame.contentWindow) {
        // iframeのドキュメントを取得
        const frameDoc =
            previewFrame.contentDocument || previewFrame.contentWindow.document;

        // ドキュメントを書き換え
        frameDoc.open();
        frameDoc.write(html);
        frameDoc.close();
    } else {
        // フォールバック: data URLを使用
        previewFrame.src =
            "data:text/html;charset=utf-8," + encodeURIComponent(html);
    }
}

// ステータス表示の更新
function updateStatus(message, type = "info") {
    const statusElement = document.getElementById("editor-status");
    statusElement.textContent = message;

    // ステータスタイプに応じてスタイルを変更
    statusElement.className = "status";
    if (type === "error") {
        statusElement.classList.add("status-error");
    } else if (type === "success") {
        statusElement.classList.add("status-success");
    } else {
        statusElement.classList.add("status-info");
    }
}

// example.mwファイルを読み込む関数
async function loadExampleFile() {
    try {
        // 確認ダイアログを表示
        if (
            editor.getValue().trim() !== "" &&
            !confirm("現在の内容が失われますが、サンプルを読み込みますか？")
        ) {
            return;
        }

        updateStatus("サンプルファイル読み込み中...");

        // example.mwファイルをサーバーから取得
        const response = await fetch("/example.mw");

        if (!response.ok) {
            throw new Error(
                `サンプルファイルの取得に失敗しました: ${response.status} ${response.statusText}`
            );
        }

        const content = await response.text();

        // エディタにコンテンツをセット
        editor.setValue(content);

        // プレビューの更新
        updatePreview();

        updateStatus("サンプルファイルを読み込みました", "success");
    } catch (error) {
        console.error("サンプルファイル読み込みエラー:", error);
        updateStatus(`エラー: ${error.message}`, "error");
    }
}
