# Codex と今の状態を合わせる（2026-11-19）

書いた人: 総合担当（Claude Code）。原作者が Codex に下の枠の中を貼る。

---

```text
最新の状態に合わせてください。まず次の3つを読み直してください（リポジトリは git pull 済みの main）。

1. AGENTS.md の「今の本流」の節
2. docs/00-core/PROJECT_STATUS_2026-11-18.md（今の状態の一覧・画面ごとの正本の仕様書・担当）
3. docs/00-core/current_screens/README.md と画像（今の画面を 1688×780 の実寸で撮ったもの）

要点:
- ゲームの本体は Unity 版。ブラウザ版（index.html・game.js、GitHub Pages の my-srpg）は古い試作で、画面の基準にしない（844×390 の戦闘画面・VS予測の枠 98px など）。
- 探索は2Dの横スクロール、戦闘は3Dの盤面＋SD、会話は会話枠 H（吹き出しは真ん中・1行13字・3行・ページごとに大きさが変わる）、拠点メニューは Hub2。画面の基準は 1688×780。
- 公開中の Unity 版 https://yuu3535.github.io/my-srpg-unity/ は 2026-11-18 に今の版へ更新した。
- 戦闘UIはデザインのチャットで作り直す予定（依頼文 docs/30-planning/BATTLE_UI_DESIGN_HANDOFF_2026-11-18.md）。戦闘で使う絵（顔の切り抜きなど）の大きさは、戦闘UIが決まってから決める。
- 立ち絵の塗りや大きさは、current_screens の会話の画面に置いたときの見え方で判断してください。
- 立ち絵の統一加工ツール（tools/tachie_unify.py・tools/style_rules.json）は Codex で方針を決める担当です（Claude Code は指示がない限り触りません）。
- 判断や決まったことは docs/ の文書と docs/90-worklogs/WORK_MEMO_YYYY-MM-DD.md に残してください（会話の履歴は Claude Code と共有されません）。
```
