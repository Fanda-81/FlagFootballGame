# Flag Football Pass — 腰旗橄榄球传球训练 🏈

Madden 风格的腰旗橄榄球传球训练网页游戏（PWA）：选战术 → 3D 球场 → 传球 → 接球判定，手机浏览器即开即玩，可「添加到主屏幕」当 App 使用。

## 快速开始

**Windows 电脑**：双击 `start.bat`（自动装依赖 → 启动 → 打开浏览器）。

**手动**：

```bash
npm install
npm run dev        # 开发：http://localhost:5173
```

**手机**：电脑与手机连同一 Wi-Fi，运行 `npm run dev -- --host`，手机浏览器访问终端显示的 Network 地址（如 http://192.168.x.x:5173）。建议横屏，可「添加到主屏幕」全屏安装。

> ⚠️ 不要直接双击打开 `index.html`——源码版必须经过 Vite 构建才能运行（浏览器会拦截 `file://` 下的模块加载）。

## 玩法

1. 底部 **Madden 风格战术卡片**选一档战术：Slant 斜插 / Hitch 急停 / Out 外切 / Go 直下（卡片上画有路线图与推荐球型）
2. 开球后 WR 沿路线跑动，**点住 QB 传球**：
   - **轻点**（<250ms）＝ 高球 Lob：高弧线、滞空长 → 适合 Go 深路线
   - **长按**（≥250ms，出现金色蓄力环）＝ 平快球 Bullet：快而直 → 适合短中路线
3. 掐时机：球按出手瞬间 WR 的跑动方向飞行——拐点前传 lob 会传大；WR 停下超过 0.7s 未出手判「太晚了」
4. 完美接球（WR 跑动中接住）累计连击；传大/传短/传偏/太晚都会打断连击

## 功能

- 🎴 **抽卡**：随机生成外接手卡（SPD 速度 / CTH 接球 / RTE 路线 / AGI 敏捷，60-95），属性真实影响游戏（速度影响跑动、接球影响容差）
- 🃏 **球员卡**：查看收藏（默认 QB「天枢·镇场者」+ WR「疾风·斜插者」）
- ⚙️ **设置**：画质（高/低省电）、音量（占位）、重置数据——自动保存到 localStorage
- 🛒 **商城**：MVP 骨架（球衣/装备/球场主题，敬请期待）

## 测试与构建

```bash
npm test           # Vitest 全量（38 条：球物理/判定/路线/手势/持久化/全链路集成）
npm run typecheck  # tsc --noEmit
npm run build      # 产出 dist/（可部署任意静态服务器）
npm run icons      # 重新生成 PWA 图标
```

## 发布到 GitHub Pages（App 分发方案）

```bash
npm run build
# 将 dist/ 推送到 GitHub Pages 分支或任意静态托管（Netlify/Vercel 同理）
```

仓库推上 GitHub 后，在仓库 Settings → Pages 选择部署 `dist/`；手机访问 Pages 地址 → 浏览器菜单「添加到主屏幕」即可像 App 一样全屏使用。项目已配置 `base: './'`（相对路径）与 PWA manifest（192/512 图标、离线缓存），任意子路径可部署。

## 项目结构

```
src/
├── core/       types.ts（类型+状态枚举）/ stateMachine.ts（游戏状态机，纯逻辑）
├── gameplay/   routes / ballPhysics / catchJudge / routeRunner / playDirector（纯逻辑，可单测）
├── data/       plays.ts（战术库）/ cards.ts（球员卡+抽卡）/ storage.ts（localStorage）
├── three/      scene / camera / renderer（Three.js 渲染层）
├── ui/         playCall / gestures / modals / sideButtons / style.css
└── main.ts     装配：状态机 ↔ 渲染 ↔ 手势 ↔ UI
```

游戏逻辑（`gameplay/`、`core/`）与渲染彻底分离，全部可单元测试；渲染层仅做画面同步。

## 3D 美术资产

- **环形体育场** `public/models/stadium.glb`：Poly Pizza（Poly by Google，CC0）低多边形体育场，环绕球场一周，加载后自动隐藏几何看台；加载失败回退内置几何看台+人群
- **橄榄球头盔** `public/models/helmet.glb`：Poly Pizza（CC0），替换球员几何头；加载失败回退几何头盔
- 所有外部模型按包围盒自动缩放对齐，**不需要手动调比例**

### 想要更真实的球员？自备模型（Mixamo 路线）

免费的真实感骨骼动画球员可从 [Mixamo](https://www.mixamo.com)（Adobe 账号）下载 FBX 动画角色（如「American Football Player」风格 + 跑步动画），用 [Blender](https://www.blender.org) 或在线工具转成 `.glb`，放入 `public/models/`，然后在 `src/main.ts` 的 `loadHelmet` 附近参照 `loadHelmet`/`applyHelmet` 写一段 loader 替换球员即可——挂点与动画管线已就绪。注意：手机浏览器内存有限，建议单模型 ≤2MB、骨骼 ≤40。

## 路线图

- [ ] **识图战术分类**：上传战术板照片 → 识别路线（预留：路线数据即 `RouteDef` 折线，接入 OCR/图像模型即可生成）
- [ ] 防守球员 AI（腰旗防守者，传球窗口压缩）
- [ ] 多外接手 + 滑动选择传球目标
- [ ] 音效/背景乐（音量设置已预留）
- [ ] 商城实装：球衣颜色/装备/球场主题（球员模型材质已参数化）
- [ ] 完整比赛模式：档数推进、达阵计分
