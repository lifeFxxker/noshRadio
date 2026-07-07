# 歌曲漂流瓶

## 目标
用户 A 听到喜欢的歌可以"丢"进海里，其他用户随机"捞"到这首歌并看到是谁推荐的。

## 数据流

```
丢瓶: A 点击 → { song: {name, artist, id, ...}, recommender: "A" }
           → 服务器存到 bottles.json

捞瓶: B 点击 → GET /api/bottle/pick?user=B
           → 服务器从 bottles.json 随机挑一条 recommender !== "B" 的
           → 删掉这条 → 返回给 B
           → B 前端 searchAndPlay(song.name, song.artist) → 播 → 显示"A 推荐"
```

## 改动清单

### proxy-server.js（新增 3 个端点）
- [ ] `POST /api/bottle/throw` — 存 `{song, recommender, timestamp}` 到 `bottles.json`
- [ ] `GET /api/bottle/pick?user=B` — 随机取一瓶别人的推荐，取完删掉
- [ ] `GET /api/bottle/count` — 海里还剩多少瓶
- [ ] `bottles.json` 文件存储位置（data/bottles.json）

### nosh-music-ai.html（前端 UI）
- [ ] 用户名系统（localStorage 存一个昵称，首次弹窗或默认设备名/随机名）
- [ ] 播放器卡片上/底部加 **"丢漂流瓶"** 按钮 → 丢当前歌曲
- [ ] 底部加 **"捞漂流瓶"** 按钮 → 随机捞一首播
- [ ] 如果是别人推荐的歌，歌曲信息显示 `🎵 ××× 推荐了这首歌`
- [ ] 丢瓶后短暂 toast 反馈

### 约束
- 不能捞到自己丢的瓶子
- 捞走的瓶子从海面消失（一次性）
- 空海时提示"海面空空的，等人丢瓶子吧"
