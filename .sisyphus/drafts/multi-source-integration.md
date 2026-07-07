# 多音源集成规划

## 需求背景
- 现有项目集成了酷狗、网易云音源
- 孙燕姿等歌手的部分歌曲在开源项目AlgerMusicPlayer中能搜到播放，但我们的项目搜不到且无法播放
- 原因：AlgerMusicPlayer使用@unblockneteasemusic/server作为多音源代理，自动切换咪咕、酷我、JOOX等音源

## 技术分析

### 核心差异
| 我们的项目 | AlgerMusicPlayer |
|-----------|------------------|
| 网易云灰色歌曲 → 酷狗搜不到就放弃 | 网易云灰色歌曲 → 自动尝试咪咕/酷我/JOOX |
| 2个音源 | 4+个音源自动切换 |

### UnblockNeteaseMusic 支持的音源
- migu (咪咕)
- kugou (酷狗)
- kuwo (酷我)
- pyncmd (JOOX)

## 待确认问题
1. 项目技术栈是什么？ (Electron/Web/App/其他)
2. 现有酷狗、网易云API的集成方式？
3. 部署环境偏好？

## 可能的解决方案
1. 集成 @unblockneteasemusic/server 作为本地代理服务
2. 扩展现有音源接口，添加自动切换逻辑
3. 使用第三方多音源SDK