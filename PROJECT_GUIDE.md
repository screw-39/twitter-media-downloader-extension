# 專案導覽與上手指南

這份文件的目的，是幫你在不熟前端與 Chrome 擴充套件的情況下，也能看懂這個專案目前是怎麼運作的，並知道之後要從哪裡開始修改。

## 這個專案在做什麼

這是一個 Chrome 擴充套件。當你瀏覽 Twitter/X 時，它會：

1. 偵測頁面上的每一則貼文
2. 檢查貼文裡有沒有圖片、影片或音訊
3. 如果有媒體，就在貼文操作列插入一個「下載媒體」按鈕
4. 你按下按鈕後，會把該貼文的媒體資訊送到背景腳本
5. 背景腳本整理出真正可下載的媒體網址，建立檔名與資料夾，最後呼叫 Chrome 下載 API

可以把它想成兩個主要部分：

- `content script`：在 Twitter/X 頁面上工作，負責看畫面、加按鈕、收集貼文資訊
- `background service worker`：不直接顯示在頁面上，負責處理下載、設定、和較偏系統層的工作

## 專案檔案總覽

### `manifest.json`

這是 Chrome 擴充套件的入口設定檔。Chrome 會先讀這個檔案，知道：

- 這個擴充套件叫什麼名字
- 版本是多少
- 需要哪些權限
- 哪些檔案要被注入到 `x.com` / `twitter.com`
- 背景腳本是哪個檔案
- 設定頁是哪個檔案

你可以把它想成專案的總開關與總配置。

### `src/content.js`

這是內容腳本，會被注入到 Twitter/X 頁面中。

它的主要責任是：

- 持續掃描頁面上的貼文
- 找出含有媒體的貼文
- 在貼文操作列插入下載按鈕
- 收集這則貼文的媒體與基本資訊
- 把資料送給背景腳本下載

如果你之後想改「按鈕在哪裡出現」、「怎麼判斷貼文有媒體」、「按下按鈕時送出什麼資料」，主要就是改這個檔案。

### `src/content.css`

這是下載按鈕的樣式檔。

它控制：

- 按鈕顏色
- 圓角
- hover 效果
- disabled 狀態
- 按鈕在貼文操作列中的排版

如果你想改按鈕外觀，優先看這個檔案。

### `src/background.js`

這是背景腳本，也是整個下載流程的核心。

它的主要責任是：

- 接收內容腳本傳來的訊息
- 讀取使用者設定
- 決定真正要下載哪些媒體
- 在必要時解析影片/GIF 的真實媒體來源
- 產生下載檔名與資料夾路徑
- 呼叫 `chrome.downloads.download()` 開始下載

如果你想改下載行為、檔名規則、資料夾規則、影片解析邏輯，主要就是改這個檔案。

### `src/options.html`

這是設定頁的 HTML 結構。

它定義了畫面上有哪些欄位，例如：

- 下載子資料夾
- 檔名格式
- 是否每次另存新檔

### `src/options.css`

這是設定頁的樣式。

如果你想讓設定頁更漂亮、改版面、改字體與顏色，主要就是改這個檔案。

### `src/options.js`

這是設定頁的行為邏輯。

它負責：

- 載入已儲存設定
- 把設定值填回表單欄位
- 使用者按下儲存時，把設定寫入 `chrome.storage.sync`

### `src/popup.html`

這是點擊 Chrome 工具列擴充套件圖示時出現的小視窗。

目前功能很簡單，主要是：

- 告訴你怎麼使用
- 提供一個進入設定頁的入口

### `README.md`

這是對外使用說明，比較偏安裝與功能介紹。

### `PROJECT_GUIDE.md`

也就是你現在正在看的這份文件。它偏向開發者導覽，目標是幫你理解整個專案。

## 整體工作流程

下面用最簡單的方式描述整個流程。

### 流程 1：擴充套件被載入

1. Chrome 先讀 `manifest.json`
2. 進入 `x.com` 或 `twitter.com` 時，Chrome 會自動注入 `src/content.js` 和 `src/content.css`
3. 背景腳本 `src/background.js` 也會在需要時被喚醒

### 流程 2：頁面上出現貼文

1. `content.js` 用 `MutationObserver` 監看頁面變化
2. 每次頁面新增或更新內容時，重新掃描貼文
3. 對每則貼文執行媒體偵測
4. 如果有媒體，就在操作列加入下載按鈕

### 流程 3：你按下下載按鈕

1. `content.js` 重新收集一次該貼文的媒體資料
2. 建立一個 payload，裡面包含：
   - tweetId
   - authorHandle
   - tweetUrl
   - mediaItems
3. 用 `chrome.runtime.sendMessage()` 把資料送給 `background.js`

### 流程 4：背景腳本準備下載

1. `background.js` 收到 `DOWNLOAD_MEDIA` 訊息
2. 讀取目前設定
3. 如果媒體是圖片，通常直接可下載
4. 如果媒體是影片或 GIF，會嘗試透過貼文 ID 解析真正可下載的媒體 URL
5. 根據使用者設定產生下載資料夾與檔名
6. 呼叫 `chrome.downloads.download()` 開始下載

## 主要函式說明

下面只講最重要的函式，讓你先抓主幹，不需要一開始就把所有細節吃完。

## `src/content.js`

### `initTwitterMediaDownloader()`

這是整個內容腳本的起點。它建立 observer、安排掃描、並讓整個貼文按鈕插入流程開始運作。

### `scheduleScan()`

避免頁面變動太頻繁時一直重複掃描。它會把多次變動合併成較少次的掃描。

### `scanTweets()`

找出頁面上所有貼文，然後一則一則交給 `syncButtonForTweet()` 處理。

### `syncButtonForTweet(tweet)`

這個函式會決定：

- 這則貼文有沒有媒體
- 有沒有操作列可插入按鈕
- 按鈕需不需要新增、移動、或移除

你可以把它想成「單一貼文的按鈕管理中心」。

### `findActionBar(tweet)`

在一則貼文裡找到放回覆、轉推、喜歡等按鈕的那一列。下載按鈕就是插到這裡。

### `collectMediaFromTweet(tweet)`

從貼文 DOM 裡收集媒體資訊。

目前會嘗試找：

- 圖片
- `<video>`
- `<audio>`

它會回傳一個陣列，每個元素都是一個媒體物件。

### `normalizeImageUrl(url)`

把 Twitter/X 的圖片 URL 調整成較適合下載原圖的格式，例如加上 `name=orig`。

### `buildDownloadPayload(tweet, mediaItems)`

把貼文資訊整理成背景腳本需要的資料格式。

### `extractAuthorFromTweet(tweet)`

從貼文 DOM 中抓出作者帳號。如果從網址推不出作者，會用這個函式做備援。

### `setButtonState(button, label, disabled)`

改按鈕文字與 disabled 狀態，例如「下載中...」、「下載失敗」這些狀態切換就是靠它。

## `src/background.js`

### `DEFAULT_SETTINGS`

定義預設設定，例如：

- 預設下載資料夾：`{author}`
- 預設檔名格式：`{author}_{tweetId}_{index}`
- 是否顯示另存新檔視窗

### `chrome.runtime.onInstalled.addListener(...)`

當擴充套件第一次安裝或更新時，初始化預設設定。

### `chrome.runtime.onMessage.addListener(...)`

背景腳本的訊息入口。

目前最重要的訊息有：

- `DOWNLOAD_MEDIA`
- `GET_SETTINGS`

這就像背景腳本的 API 入口。

### `handleDownload(payload)`

真正執行下載主流程的函式。

它會：

1. 讀設定
2. 解析媒體項目
3. 逐個建立檔名
4. 逐個呼叫 Chrome 下載 API

### `resolveMediaItems(payload)`

決定要直接使用內容腳本送來的媒體 URL，還是需要進一步解析。

特別是影片/GIF，頁面上常常只有 `blob:` 這種不能直接下載的播放位址，所以要額外處理。

### `fetchMediaFromTweetMetadata(tweetId)`

用貼文 ID 去抓取貼文媒體資訊，目的是補足影片/GIF 的真實下載連結。

### `normalizeResolvedMediaItem(item)`

把遠端拿到的媒體資料，整理成專案內部統一格式，例如轉成：

- `type`
- `sourceUrl`
- `downloadUrl`

### `pickBestVideoVariant(variants)`

Twitter/X 的影片通常有多個清晰度版本。這個函式會挑選一個最適合下載的 MP4，現在的策略是優先選 bitrate 較高的版本。

### `stripVideoQuery(url)`

有些影片 URL 帶查詢參數，這個函式會把不必要的 query 去掉，讓下載 URL 更乾淨。

### `buildFilename(item, payload, settings, index)`

根據媒體類型、作者、貼文 ID、序號與設定，組出最終下載路徑，例如：

```text
{author}/{author}_{tweetId}_{index}.jpg
```

### `applyTemplate(template, tokens)`

把設定中的變數替換成實際值，例如：

- `{author}` -> `OpenAI`
- `{tweetId}` -> `1234567890`

### `inferExtension(item)`

根據媒體類型與 URL 推斷副檔名。

### `normalizeImageUrl(url)`

和內容腳本中的用途類似，用來確保圖片下載 URL 比較合理。

### `sanitizeFolder(value)`

把資料夾路徑處理成安全格式，避免出現 Windows 不允許的字元。

### `sanitizePathSegment(value)`

把單一路徑片段中的非法字元替換掉，避免下載失敗。

## `src/options.js`

### `DEFAULT_SETTINGS`

設定頁預設值，通常要和 `background.js` 保持一致。

### `initialize()`

開啟設定頁時，從 `chrome.storage.sync` 讀取設定，並填進表單欄位。

### `form.addEventListener("submit", ...)`

使用者按下儲存按鈕時，把設定寫入 `chrome.storage.sync`。

## 如果你要開始讀這個專案，建議順序

如果你現在想真正上手，不要從頭亂讀全部檔案。建議這樣看：

1. 先看 `manifest.json`
   - 先知道這個擴充套件有哪些入口
2. 再看 `src/content.js`
   - 先理解畫面上按鈕怎麼出現
3. 再看 `src/background.js`
   - 理解按下按鈕後，下載是怎麼完成的
4. 最後看 `src/options.html` + `src/options.js`
   - 理解設定值怎麼影響下載行為

這樣看會最有方向感。

## 如果你要自己修改功能，建議從哪裡開始

### 想改按鈕外觀

先看：

- `src/content.css`

### 想改按鈕插入位置或按鈕文字

先看：

- `src/content.js`
- 特別是 `syncButtonForTweet()`

### 想改資料夾命名或檔名格式

先看：

- `src/background.js`
- 特別是 `buildFilename()`、`applyTemplate()`

### 想改設定頁欄位

先看：

- `src/options.html`
- `src/options.js`

### 想改影片/GIF 下載邏輯

先看：

- `src/background.js`
- 特別是 `resolveMediaItems()`、`fetchMediaFromTweetMetadata()`、`pickBestVideoVariant()`

## 建議你的第一個練習

如果你想快速熟悉這個專案，我建議做以下幾個小練習。

### 練習 1：改按鈕文字

把 `下載媒體` 改成你自己喜歡的文字，例如：

- `儲存媒體`
- `下載圖片/影片`

這能幫你熟悉 `content.js`。

### 練習 2：改按鈕顏色

去 `content.css` 把按鈕背景色與字色換掉。

這能幫你熟悉樣式檔。

### 練習 3：改預設檔名格式

例如從：

```text
{author}_{tweetId}_{index}
```

改成：

```text
{tweetId}_{type}_{index}
```

這能幫你理解 `background.js` 的模板替換邏輯。

### 練習 4：新增一個設定欄位

例如增加「是否把作者名稱加到檔名」這種選項。

這會讓你同時接觸：

- `options.html`
- `options.js`
- `background.js`

這是很好的進階練習。

## 你之後可能會遇到的常見問題

### 1. Chrome 重新整理擴充套件後沒有生效

通常要做兩件事：

1. 去 `chrome://extensions/` 按重新整理
2. 回 Twitter/X 網頁再重新整理一次

### 2. X/Twitter 改版後按鈕突然不見

通常是 DOM 結構變了。

優先檢查：

- `article[data-testid="tweet"]`
- `div[role="group"]`
- 貼文中圖片與影片的選擇器

也就是優先看 `content.js`。

### 3. 影片下載失敗

通常原因是：

- 頁面上拿到的是 `blob:` URL
- 遠端媒體資訊格式變了
- 目前解析邏輯沒有匹配到新的影片資料格式

優先看：

- `resolveMediaItems()`
- `fetchMediaFromTweetMetadata()`

### 4. 設定改了但下載結果沒變

先檢查：

- 設定頁是否真的按了儲存
- `background.js` 跟 `options.js` 的 `DEFAULT_SETTINGS` 是否一致

## 接下來你可以怎麼繼續

如果你想更有系統地學會這個專案，我建議你下一步做這三件事：

1. 先讀 `manifest.json`、`content.js`、`background.js` 三個檔案
2. 一次只改一個小地方，例如按鈕文字或預設檔名
3. 每改一次，就重新整理擴充套件並測試結果

這樣你會比一次想理解全部細節更快上手。

## 最後給你的建議

你現在不需要先把「前端」、「Chrome extension」、「DOM」、「非同步 JavaScript」全部學完才碰這個專案。比較好的方式是：

- 先知道功能從哪個檔案進來
- 知道資料怎麼流動
- 每次只理解一小段程式
- 每做一個小改動就重新測試

這個專案其實已經有很清楚的分工：

- 頁面互動在 `content.js`
- 下載邏輯在 `background.js`
- 設定在 `options.*`
- 入口設定在 `manifest.json`

只要先抓住這四塊，你就已經能開始維護它了。
