# 五排預測賽:部署說明(約 15 分鐘,全部免費)

## 1. Supabase(資料庫)
1. 到 supabase.com 註冊,New project 建一個專案。
2. 左邊選 SQL Editor,貼上 `supabase.sql` 全部內容,按 Run。
3. 到 Project Settings → API,記下三樣:Project URL、anon public key、service_role key。

## 2. GitHub
1. 在 github.com 建一個新的 repository(Private 也可以)。
2. 把這個資料夾裡的所有檔案(api、public、supabase.sql、vercel.json)上傳上去(網頁上 Add file → Upload files 即可)。

## 3. Vercel(網站)
1. 到 vercel.com 用 GitHub 登入,Add New → Project,選剛才的 repository,Framework 選 Other。
2. 在 Environment Variables 填入四個變數:
   - SUPABASE_URL:Project URL
   - SUPABASE_ANON_KEY:anon public key
   - SUPABASE_SERVICE_KEY:service_role key(不可外流)
   - HENRIK_KEY:你的 HenrikDev API Key(建議先換一把新的)
3. 按 Deploy。完成後會得到一個網址,例如 https://xxx.vercel.app。

## 4. 開始使用
開啟網址,輸入房間代碼進入,到「玩家」頁填好五個人的 Riot ID,把網址加上 `?room=房間代碼` 傳給朋友。
