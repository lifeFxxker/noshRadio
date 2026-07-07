# Draft: 像素小人动画

## Requirements (confirmed)
- 给右下角的像素小人加动态动作
- 正常时眼睛可以跟随鼠标移动
- 播放时嘴巴跟随音乐律动
- 完全重现原图外观（基于 nosh-avatar.png），不改变角色形象

## Technical Decisions
- 方法：Canvas 叠加层（保留原 img，叠加透明 canvas，只画动画部分）
- 眼球：在蓝色护目镜区域画两个像素化的瞳孔点，跟随鼠标位置
- 嘴巴：在橙色嘴部区域画一个弧线，随 smoothBass 能量开合
- 身体弹跳：CSS transform: scale/translate 随 beatPulse 变化
- 动画循环：复用现有的 updateRhythm() 的 requestAnimationFrame

## Character Structural Analysis (from pixel scan)
- 蓝色护目镜：y≈456-496（22-24% from top），宽约 x=850-1200
- 面部肤色：y≈860-1340（42-65% from top）
- 嘴巴：y≈1360-1376（66-67% from top）
- 身体/衣服：y≈1488+（73%+ from top）

## Research Findings
- 已有基础：smoothBass/smoothMid/smoothTreble 三个能量值，60fps updateRhythm 循环
- 嘴巴位置用橙色（R≈248, G≈153, B≈99）
- sprite-btn 使用 image-rendering:pixelated

## Open Questions
- 瞳孔颜色和样式细节
- 嘴巴动画的具体风格（微笑弧度变化？开合大小？）

## Scope Boundaries
- INCLUDE: 眼睛跟随鼠标、嘴巴随音乐律动、身体随节拍弹跳
- EXCLUDE: 不改变聊天面板、不影响其他页面元素、不改变角色外观
