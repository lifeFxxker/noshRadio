# 酷狗登录功能实现计划

## 需求
在 NOSH 音乐平台添加酷狗手机号登录功能

## 酷狗API接口

### 1. 发送验证码
- 接口：`POST http://localhost:3001/captcha/sent`
- 参数：`mobile` (手机号)

### 2. 验证码登录
- 接口：`POST http://localhost:3001/login/cellphone`
- 参数：`mobile`, `code` (验证码)

### 3. 登录成功后返回
- `token`: 用户令牌
- `userid`: 用户ID
- `vip_type`: VIP类型
- `vip_token`: VIP令牌

## 实现内容

### 前端 (nosh-music-ai.html)
1. 添加登录按钮到界面
2. 点击弹出登录弹窗
3. 输入手机号 → 发送验证码 → 输入验证码 → 登录
4. 登录成功后显示用户信息

### 后端 (nosh-music-ai.html JavaScript)
1. 调用酷狗API发送验证码
2. 调用酷狗API验证登录
3. 保存登录状态（localStorage或cookie）
4. 登录状态随请求发送

## 状态管理
- 保存登录信息到 localStorage
- 每次API请求附带你登录token
- 页面加载时检查登录状态