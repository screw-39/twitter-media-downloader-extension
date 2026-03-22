# Twitter Media Downloader Extension

這是一個 Chrome Manifest V3 擴充套件，會在 Twitter/X 貼文偵測到媒體時，自動在貼文操作區加入「下載媒體」按鈕，點擊後會下載該則貼文中的圖片、影片或音訊。

## 已完成功能

- 在 `twitter.com` 與 `x.com` 的貼文中偵測圖片、影片、音訊媒體
- 在每則含媒體的貼文下方加入下載按鈕
- 一次下載該貼文中的全部媒體
- 可在設定頁自訂下載子資料夾
- 可在設定頁自訂檔名格式
- 可選擇是否每次下載時都顯示另存新檔視窗
- 一般影片會優先解析可直接下載的 MP4 位址，而不是頁面內的 `blob:` 播放位址

## 重要限制

Chrome 擴充套件單靠 `chrome.downloads` API，通常只能控制「瀏覽器預設下載資料夾底下的子路徑」，不能直接寫入任意 Windows 絕對路徑，例如 `D:\my-media\twitter`。

目前這個版本支援：

- 下載到 Chrome 預設下載資料夾底下的指定子資料夾
- 或者讓 Chrome 在每次下載時跳出另存新檔對話框

如果你下一步要做到「固定寫入任意絕對路徑」，可以再延伸加入 Native Messaging 本機小程式。

## 安裝方式

1. 開啟 Chrome，進入 `chrome://extensions/`
2. 開啟右上角的「開發人員模式」
3. 點擊「載入未封裝項目」
4. 選擇本專案資料夾：`D:\working_place\twitter-media-downloader-extension`

## 使用方式

1. 安裝後前往 Twitter/X
2. 找一則含圖片、影片或音訊的貼文
3. 在貼文操作列找到「下載媒體」按鈕
4. 點擊後，媒體會加入 Chrome 下載清單
5. 若要修改下載子資料夾或檔名格式，可打開擴充套件的設定頁

## 預設下載路徑

目前預設會下載到：

```text
下載/{author}
```

也就是會依發文者帳號自動分資料夾儲存。

## 檔名格式變數

- `{author}`: 發文帳號
- `{tweetId}`: 貼文 ID
- `{index}`: 媒體序號
- `{type}`: 媒體類型

下載子資料夾也支援同樣的變數。

預設檔名格式：

```text
{author}_{tweetId}_{index}
```

## GIF 與影片說明

- X/Twitter 上的「GIF」通常實際是平台提供的循環 MP4，不一定存在真正的 `.gif` 原始檔
- 這個版本會盡量解析官方提供的影片變體，優先下載真正可存檔的 MP4
- 如果某則影片仍然無法下載，通常代表該貼文的媒體資訊沒有從目前頁面或公開端點成功解析

## 專案結構

```text
twitter-media-downloader-extension/
  manifest.json
  README.md
  src/
    background.js
    content.js
    content.css
    options.html
    options.css
    options.js
    popup.html
```
