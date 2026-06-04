# Teaser ブロック設計書

## 1. 概要

### 1.1 目的

Teaser ブロックは、画像・タイトル・本文・CTA（Call to Action）ボタンを組み合わせたプロモーション用コンポーネントです。Universal Editor（UE）上で各要素を個別に編集でき、Title / Text / CTA の配置（alignment）と本文色を独立して制御できます。

### 1.2 設計方針

| 方針 | 内容 |
|------|------|
| JS 不使用 | alignment・文字色は JSON の `classes_*` + CSS で制御。画像 URL の `<picture>` 化のみ `teaser.js` で実施 |
| class は JSON で定義 | `classes_*` フィールドの value がブロック root の class になる |
| スタイルは CSS のみ | alignment・文字色は `teaser.css` で制御 |
| セル分離 | Title / Text / CTA / Image を別セルとしてモデル化し、互いの alignment が干渉しないようにする |

### 1.3 参考

- [Create a block（Adobe Experience League）](https://experienceleague.adobe.com/en/docs/experience-manager-learn/sites/edge-delivery-services/developing/universal-editor/5-new-block)
- [Content modeling for AEM authoring projects](https://www.aem.live/developer/component-model-definitions)

---

## 2. ファイル構成

```
blocks/teaser/
├── _teaser.json    … 定義（definitions）・モデル（models）・フィルター（filters）
├── teaser.js       … 画像 URL の picture 化・PC/SP 行 class 付与
├── teaser.css      … ブロックスタイル
└── DESIGN.md       … 本設計書
```

### 2.1 ビルド成果物

`npm run build:json` 実行後、以下にマージされる。

| 出力ファイル | 内容 |
|-------------|------|
| `component-definition.json` | Teaser の UE 登録情報 |
| `component-models.json` | 編集フィールド定義 |
| `component-filters.json` | Section への追加許可（`models/_section.json` 経由） |

### 2.2 Section への登録

`models/_section.json` の `section` フィルターに `"teaser"` が含まれている。Section 内に Teaser を追加できる。

---

## 3. コンテンツモデル

### 3.1 モデル ID

`teaser`

### 3.2 タブ構成

UE のプロパティパネルは 4 タブに整理している（タブは UI 整理のみ。HTML 行の出し分けには直接関与しない）。

| タブ | フィールド |
|------|-----------|
| Title | `title`, `titleType`, `classes_titleAlign` |
| Text | `text`, `classes_textAlign`, `classes_textColor` |
| CTA | `cta`, `ctaText`, `classes_ctaAlign` |
| Image | `image`, `imageAlt` |

### 3.3 フィールド一覧

| フィールド名 | コンポーネント | 必須 | 説明 |
|-------------|---------------|------|------|
| `title` | text | — | タイトル文字列 |
| `titleType` | select | — | 見出しレベル（h1〜h6）。`title` と Field Collapse で `<h*>` に合成 |
| `classes_titleAlign` | select | — | タイトル配置。ブロック class として付与 |
| `text` | richtext | ✓ | 本文（HTML 可） |
| `classes_textAlign` | select | — | 本文配置。ブロック class として付与 |
| `classes_textColor` | select | — | 本文色。ブロック class として付与 |
| `cta` | aem-content | — | CTA リンク先 |
| `ctaText` | text | — | CTA ラベル。`cta` と Field Collapse で `<a>` に合成 |
| `classes_ctaAlign` | select | — | CTA 配置。ブロック class として付与 |
| `image` | reference | — | PC 用画像アセット |
| `imageAlt` | text | ✓ | PC 用代替テキスト。`image` と Field Collapse で `<picture>` に合成 |
| `imageMobile` | reference | — | SP 用画像アセット（任意）。未設定時は PC 画像を全画面幅で使用 |
| `imageMobileAlt` | text | — | SP 用代替テキスト。`imageMobile` と Field Collapse で合成 |

### 3.4 Field Collapse（フィールド折りたたみ）

AEM の命名規則により、複数フィールドが 1 つのセマンティック要素に合成される。

| ベースフィールド | 属性フィールド | 出力 HTML |
|----------------|---------------|-----------|
| `title` | `titleType` | `<h1>`〜`<h6>` |
| `cta` | `ctaText` | `<a href="...">...</a>` |
| `image` | `imageAlt` | `<picture><img alt="..."></picture>`（PC） |
| `imageMobile` | `imageMobileAlt` | `<picture><img alt="..."></picture>`（SP） |

### 3.5 フィールド命名について（`textContent_*` を使わない理由）

Adobe チュートリアルでは `textContent_*` プレフィックスで要素グループ化する例があるが、本ブロックでは **使用しない**。

`textContent_title` / `textContent_text` などはすべて `textContent` グループに属し、**1 つのセルにまとまって出力**される。その結果、Title と Text の alignment を CSS で独立制御できなくなる。

代わりに `title`, `text`, `cta`, `image` という **独立したフィールド名** を使い、それぞれ別セルとして出力する。

---

## 4. ブロックオプション（`classes_*`）

`classes_` プレフィックス付きフィールドは HTML 行には出力されず、**ブロック root 要素の class** として付与される。

### 4.1 alignment オプション

| フィールド | class 値 | 適用対象 |
|-----------|---------|---------|
| `classes_titleAlign` | `title-align-left` / `title-align-center` / `title-align-right` | タイトル（見出し） |
| `classes_textAlign` | `text-align-left` / `text-align-center` / `text-align-right` | 本文 |
| `classes_ctaAlign` | `cta-align-left` / `cta-align-center` / `cta-align-right` | CTA ボタン |

### 4.2 文字色オプション

| フィールド | class 値 | 適用対象 |
|-----------|---------|---------|
| `classes_textColor` | （空） / `text-color-red` / `text-color-blue` / `text-color-green` | 本文のみ |

---

## 5. HTML 出力構造

### 5.1 想定 DOM

AEM から出力され、Franklin 共通処理（`wrapTextNodes`, `decorateButtons`）適用後の構造。

```html
<div class="teaser block title-align-left text-align-left cta-align-left">
  <!-- Title 行 -->
  <div>
    <div>
      <h2>Enter a title</h2>
    </div>
  </div>
  <!-- Text 行 -->
  <div>
    <div>
      <p>...and body text here!</p>
    </div>
  </div>
  <!-- CTA 行 -->
  <div>
    <div>
      <p class="button-container">
        <a href="/" class="button">Click me!</a>
      </p>
    </div>
  </div>
  <!-- Image 行（PC） -->
  <div>
    <div>
      <picture>
        <img src="..." alt="...">
      </picture>
    </div>
  </div>
  <!-- Image 行（SP・任意） -->
  <div>
    <div>
      <picture>
        <img src="..." alt="...">
      </picture>
    </div>
  </div>
</div>
```

SP 用画像（`imageMobile`）が未設定の場合、PC 画像行のみ出力され、全画面幅で PC 画像が表示される。

### 5.2 行の識別方法（CSS）

JS で行 class を付与せず、**DOM 構造と要素種別**で行を識別する。

| 行 | CSS 上の識別条件 |
|----|----------------|
| Title | `:has(> div > h1)` 〜 `:has(> div > h6)` |
| Text | 見出し・画像・CTA（`.button-container`）を含まない行 |
| CTA | `:has(> div .button-container)` |
| Image（PC） | `:has(> div > picture)`（最初の picture 行） |
| Image（SP） | 連続する 2 つ目の `:has(> div > picture)` 行 |

---

## 6. レスポンシブ画像

### 6.1 動作

| 画面幅 | 表示 |
|--------|------|
| 900px 以上（PC） | `image` の picture 行を表示。`imageMobile` 行は非表示 |
| 900px 未満（SP） | `imageMobile` が設定されていれば SP 行を表示し PC 行を非表示 |
| SP 画像未設定 | PC 画像を全画面幅で表示 |

ブレークポイント `900px` は Hero / Columns 等のプロジェクト共通値に合わせている。

### 6.2 実装（CSS のみ）

JS は使用せず、**連続する picture 行**の表示切替で実現する。

```css
/* SP 行をデフォルト非表示 */
.block.teaser > div:has(> div > picture) + div:has(> div > picture) {
  display: none;
}

@media (width < 900px) {
  /* PC 行を非表示（SP 行がある場合のみ） */
  .block.teaser > div:has(> div > picture):has(+ div > div > picture) {
    display: none;
  }
  /* SP 行を表示 */
  .block.teaser > div:has(> div > picture) + div:has(> div > picture) {
    display: block;
  }
}
```

---

## 7. CSS 設計（alignment / 文字色）

ファイル: `teaser.css`

### 6.1 Title alignment

- 対象: `:is(h1, h2, h3, h4, h5, h6)` および見出しを含む行のセル
- 例: `.block.teaser.title-align-center :is(h1, …, h6)`

### 6.2 Text alignment

- 対象: 見出し行・CTA 行・画像行を **除外** した行の `p` / `li`
- `.button-container`（CTA 用 `<p>`）は除外
- 例: `.block.teaser.text-align-center > div:not(:has(picture, img), :has(> div > :is(h1, …, h6)), :has(> div .button-container)) …`

### 6.3 CTA alignment

- 対象: `.button-container` を含む行のセル
- `decorateButtons`（`scripts/aem.js`）が `<a>` に `.button`、親 `<p>` に `.button-container` を付与した後に有効

### 6.4 Text color

- CSS 変数 `--teaser-text-color` をブロック class で定義
- 本文行の `p` / `li` のみに適用（Title・CTA には影響しない）

---

## 8. JavaScript

### 8.1 `teaser.js` の役割

画像まわりのみ担当する（alignment / 文字色は JSON + CSS）。

| 処理 | 内容 |
|------|------|
| URL → `<picture>` | AEM が delivery URL をテキスト／リンクで出力した場合に `createOptimizedPicture` で画像化 |
| Alt 行の結合 | Field Collapse が効かず Alt が別行になっている場合、直後の Alt 行を取り込む |
| 行 class 付与 | 1 件目 → `teaser-image-desktop`、2 件目 → `teaser-image-mobile` |

### 8.2 依存する共通処理

| 処理 | ファイル | 役割 |
|------|---------|------|
| `wrapTextNodes` | `scripts/aem.js` | 裸テキストを `<p>` でラップ |
| `decorateButtons` | `scripts/aem.js` | 単一リンクの `<p>` をボタン化（`.button-container`） |
| `loadBlock` | `scripts/aem.js` | CSS の読み込み（JS モジュールが無くても CSS は適用される） |

---

## 9. Lint 設定

### 8.1 `xwalk/max-cells`

デフォルト上限は 4 セル。Teaser は以下 6 グループとしてカウントされるため、`.eslintrc.js` で例外を設定している。

| グループ | フィールド |
|---------|-----------|
| title | `title` + `titleType` |
| text | `text` |
| cta | `cta` + `ctaText` |
| image | `image` + `imageAlt` |
| imageMobile | `imageMobile` + `imageMobileAlt` |
| classes | `classes_*` 一式 |

```javascript
'xwalk/max-cells': ['error', { teaser: 6 }],
```

Title / Text / CTA / Image を分離しつつ `classes_*` ブロックオプションを使う以上、この例外設定は必要。

---

## 10. デフォルトテンプレート

`_teaser.json` の `definitions` → `template` 初期値:

```json
{
  "name": "Teaser",
  "model": "teaser",
  "classes_titleAlign": "title-align-left",
  "classes_textAlign": "text-align-left",
  "classes_ctaAlign": "cta-align-left",
  "classes_textColor": "",
  "title": "Enter a title",
  "titleType": "h2",
  "text": "<p>...and body text here!</p>",
  "cta": "/",
  "ctaText": "Click me!"
}
```

---

## 11. オーサリング手順

1. Section を選択し、コンポーネント一覧から **Teaser** を追加
2. **Title** タブ: タイトル文字列・見出しレベル・Title alignment を設定
3. **Text** タブ: リッチテキスト本文・Text alignment・Text color を設定
4. **CTA** タブ: リンク先・ラベル・CTA alignment を設定
5. **Image** タブ: PC 画像・Alt、必要に応じて SP 画像・Alt を設定
6. 公開後、`.aem.live` で表示を確認

### 10.1 alignment の独立性

| 操作 | 影響範囲 |
|------|---------|
| Title alignment 変更 | タイトル（見出し）のみ |
| Text alignment 変更 | 本文のみ |
| CTA alignment 変更 | CTA ボタンのみ |

---

## 12. ビルド・デプロイ

```bash
# JSON 定義のビルド
npm run lint
npm run build:json

# Git push → AEM Code Sync → UE / 公開サイトで確認
```

---

## 13. 制約・注意事項

| 項目 | 内容 |
|------|------|
| フィールド名変更 | `textContent_*` から `title` / `text` / `cta` に変更済み。既存 Teaser はプロパティ名が異なるため、**削除して再追加**が必要 |
| 子コンポーネント | Teaser 内に他ブロックは追加不可（`filters: []`） |
| Text color | Title・CTA には適用されない |
| CTA スタイル | ボタン見た目はグローバル `styles/styles.css` の `.button` に依存 |
| max-cells | 4 セル超のため ESLint 例外設定が必要 |
| UE タブ | タブ分けは UI 整理のみ。Content Tree の選択連動にはモデル分割が別途必要 |

---

## 14. テスト観点

- [ ] Section に Teaser を追加できる
- [ ] Title / Text / CTA / Image がそれぞれ編集・保存できる
- [ ] Title alignment を変更しても Text / CTA の位置が変わらない
- [ ] Text alignment を変更しても Title / CTA の位置が変わらない
- [ ] CTA alignment を変更しても Title / Text の位置が変わらない
- [ ] Text color が本文のみに適用される
- [ ] `titleType` 変更で h1〜h6 が切り替わる
- [ ] CTA が `.button` スタイルで表示される
- [ ] `npm run lint` がエラーなく通る
- [ ] PC / SP で画像が切り替わる（SP 未設定時は PC 画像が両方で表示）
- [ ] UE 上の変更が公開サイトに反映される

---

## 15. 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-05-29 | PC / SP レスポンシブ画像（`imageMobile`）を追加 |
| 2026-05-29 | 初版作成。Title / Text / CTA 独立 alignment、JS 不使用、`textContent_*` 廃止、max-cells 例外を反映 |
