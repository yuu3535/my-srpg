@AGENTS.md

# Claude Code 向け補足

共通の指示は上の `AGENTS.md`（Codexと共有）に書く。ここにはClaude Code固有の補足だけを置く。

## グローバル設定より本プロジェクトを優先

- `~/.claude/CLAUDE.md` のフロントエンド指針（React / Next.js / Tailwind / Framer Motion の前提、紫系配色の禁止、セリフ体の禁止、Inter禁止、カード・余白の既定値など）は本プロジェクトに適用しない。
- 本プロジェクトはビルドなしのVanilla JS構成で、UIは `PROJECT_CONSTITUTION.md` の「UIの意匠基準」（黒紫・紫の帯・金の細罫線・明朝体、ヴァイオレット×ゴールド×アンバー）に従う。

## 実行環境の注意

- Windows / PowerShell 5.1。BOMなしUTF-8の日本語ファイルは `Get-Content` だと文字化けするため、Readツールを使うか `-Encoding UTF8` を付ける。
- PowerShellでは `git commit -F -` にヒアストリングを渡せない。複数行のコミットメッセージはスクラッチパッドにファイルを書き出して `git commit -F <file>` を使う。
- 一時ファイルはプロジェクト内ではなくスクラッチパッドに置く（`.codex-tmp/` はCodexの作業領域なので触らない）。
- ブラウザ確認は静的サーバーで `index.html` を開き、横長の比率で確認する。

## Codexとの協働

- 会話履歴はCodexと共有されない。判断・決定は `docs/` の該当文書と、`docs/90-worklogs/WORK_MEMO_YYYY-MM-DD.md` に残す。
- 一区切りついたときの報告は `docs/00-core/MULTI_CHAT_COLLABORATION_GUIDE.md` §15 の形式に合わせる。
- 共通ルールを変えるときは `AGENTS.md` を更新し、Claude固有の事項だけをこのファイルに追記する。
