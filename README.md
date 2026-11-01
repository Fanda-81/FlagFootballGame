# Flag Football Pass — 腰旗橄榄球传球训练 🏈

Madden 风格的腰旗橄榄球传球训练网页游戏（PWA）：选战术 → 3D 球场 → 传球 → 接球判定。
手机浏览器即开即玩，可「添加到主屏幕」当 App 用；电脑上用鼠标滚轮缩放，手机上双指捏合缩放。

![游戏截图](docs/screenshot-desktop.png)

> **当前状态：可上线。** 构建、类型检查、46 条单测全绿；已配置 PWA 更新提示、GitHub Pages / Netlify / Vercel 部署方案。

---

## 1. 上线（让用户通过网页访问）

### 方案 A：GitHub Pages（本仓库已按此配置，免费）

仓库地址：`https://github.com/Fanda-81/FlagFootballGame`

1. **首次配置（只需做一次）**：仓库 **Settings → Pages → Build and deployment**
   - Source 选 **Deploy from a branch**
   - Branch 选 **gh-pages**，目录 **/ (root)**
   - 保存后等 30~90 秒
2. **每次发版**：

   ```bash
   git add -A && git commit -m "feat: xxx" && git push   # 源码
   npm run deploy                                        # 构建 dist/ 并强推 gh-pages
   ```

   `gh-pages` 更新后 30~90 秒生效；用户下次打开会看到「立即更新」。

3. 访问地址：`https://fanda-81.github.io/FlagFootballGame/`

> 为什么不是 GitHub Actions？这台机器上保存的 GitHub 凭据只有 `repo` 权限，
> 没有 `workflow` 权限，无法推送 `.github/workflows/` 下的文件。
> 想升级成「push 即自动构建」：到 GitHub → Settings → Developer settings → Tokens
> 重新授权一个带 `workflow` 权限的 token，然后把 `deploy/github-pages-actions.yml`
> 复制回 `.github/workflows/deploy.yml`，Pages 源改成 **GitHub Actions** 即可。
>
> 私有仓库要发布 Pages 需要 GitHub Pro；公开仓库免费。
> `vite.config.ts` 已设置 `base: './'`，放在子路径（`/仓库名/`）也能正常加载资源与 Service Worker。

### 方案 B：Netlify / Vercel / Cloudflare Pages（拖拽或连仓库，零配置）

- Netlify：仓库根目录的 `netlify.toml` 已写好（`npm ci && npm run build`，发布 `dist`）。
- Vercel：`vercel.json` 已写好（同样输出 `dist`）。
- Cloudflare Pages：构建命令 `npm run build`，输出目录 `dist`。
- 不想连仓库：本地 `npm run build`，把 `dist/` 整个文件夹拖到 Netlify Drop / Cloudflare 上传即可。

任何静态托管都行，**不需要后端**：游戏数据只存在浏览器 localStorage。

### 上线前建议自测清单

- [ ] 手机横屏进一次完整流程：选战术 → 等待跑位 → 轻点高球 / 长按平快球 → 结算
- [ ] 手机竖屏也能玩（会自动缩窄两侧按钮，顶部提示可关闭）
- [ ] 「添加到主屏幕」后全屏启动、断网重开仍能进（代码/图标/模型都已预缓存）
- [ ] 断网后点「商城」只弹提示，游戏本身照常能玩
- [ ] 设置里能看到版本号、构建时间、离线包状态

---

## 2. 迭代与「用户点一下就更新」

发布流程就是 **改代码 → `npm run deploy`**。新版本推上去后：

1. 老用户下次打开页面时，Service Worker 检测到新版本 → 底部弹出 **「🚀 新版本已就绪 · 立即更新」**；
2. 用户点一下 → 新版本激活并自动刷新（`vite-plugin-pwa` 的 `prompt` 模式）；
3. 没点的用户继续用旧版本，不会被打断。

设置弹窗里还有 **版本号 + 构建时间 + 检查更新** 按钮，方便你和用户确认是否最新。
「已缓存，可离线游玩」提示只在首次安装缓存完成时出现。

> 想给用户发版说明：改 `package.json` 的 `version`，构建时会自动显示在设置里。

### 离线可用与「下载包」

**直接分享网址就能玩，不需要下载。** 想全屏、有图标、断网也能进，才需要「安装」：

- **安装 = 下载包**：点设置里的「安装到桌面」，或浏览器地址栏的安装图标；
  iOS 用 Safari → 分享 → **添加到主屏幕**。
- 安装后首次打开，Service Worker 会把 **代码 + 图标 + 模型（约 2.4 MB）** 全部预缓存，
  设置里能看到「离线包：已缓存 1/1 ✓」。之后断网也能正常进游戏。
- **离线时**：选战术、传球、接球判定、战术本、抽卡、球员卡、画质设置全部照常；
  需要联网的功能（商城、检查更新）会提示「需要联网，离线时暂不可用」，不会报错或卡住。
- HUD 右上角离线时会显示 **📴 离线** 徽标，恢复网络自动消失。

---

## 3. 本地开发

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # tsc --noEmit
npm test           # Vitest（46 条）
npm run build      # 产出 dist/
npm run preview    # 本地预览构建产物
```

Windows 可双击 `start.bat`（自动装依赖并启动）。

手机联调：`npm run dev -- --host`，手机访问终端里的 Network 地址（同一 Wi-Fi）。

---

## 4. 玩法

1. 底部 **ACTION MENU** 三栏：QUICK PASS（短传）/ SMART PASS（纵深）/ READ & REACT（随机）。
   点开后在上方浮出战术卡片（带路线图），点卡片即开球。
2. WR 沿路线跑动，**点住 QB 传球**：
   - **轻点**（<250ms）＝ 高球 Lob：弧线高、滞空长 → 适合 Go / Post 深路线
   - **长按**（≥250ms，出现金色蓄力环）＝ 平快球 Bullet：快而直 → 适合 Slant / Hitch / Out
3. 掐时机：球按出手瞬间 WR 的跑动方向飞行。WR 停下超过 0.7s 未出手判「太晚了」。
4. 完美接球（跑动中接住）累计连击；传大/传短/传偏/太晚都会打断连击。
5. 右上「比赛」切换模拟比赛：随机站位 4 名防守球员，传球窗口被压缩，可能「被防守破坏」。

---

## 5. 3D 资产：用 Tripo 生成模型时选哪种？

**结论：网页版选「拓扑网格（Retopo / Game-ready）」，不要直接把高精度模型丢进网页。**

| | 高精度（High-poly） | 拓扑网格（Retopo） |
|---|---|---|
| 三角面 | 十几万 ~ 几百万 | 几千 ~ 3 万 |
| 用途 | 离线渲染、海报、影视 | 实时游戏 / 网页 / 手机 |
| 网页表现 | 手机掉帧、加载慢、发烫 | 流畅、包体小 |
| 贴图 | 常需烘焙法线 | 自带 PBR 贴图，直接用 |

推荐在 Tripo 里这样出资产：

- **球员**：拓扑网格，目标 **8k–15k 三角面**，贴图 **1024–2048**；单人 `.glb` ≤ 2 MB。
- **球场 / 看台**：拓扑网格，**3 万–8 万面**，贴图 2048；总 `.glb` ≤ 5 MB。
- 需要特写时，保留一份高精度源文件做「法线烘焙」：高模烘到低模的法线贴图上，网页里用低模显示，细节不丢。
- 导出设置：**GLB + 嵌入贴图**，避免 `.gltf + .bin + 一堆 jpg`；不要导出 4K 贴图（手机显存吃不消）。
- 生成后用 `gltf-transform` 再压一道（可选）：

  ```bash
  npx @gltf-transform/cli optimize in.glb out.glb --compress draco --texture-compress webp
  ```

  压缩后记得让加载器支持 Draco（`DRACOLoader`）；不用 Draco 也能跑，只是包体大一点。

### Blender 导出球员模型（踩坑清单）

**症状：导出再导入只剩骨架 / 一团“球”。**
说明导出文件里 `meshes: 0`——网格根本没被写进去；你看到的球是 Rigify 的 `WGT-*`
骨骼显示形状，不是人物模型。

常见原因只有两个：

1. 导出面板「数据 → 网格」没勾（「材质」同理）；
2. 「包括 → 选中物体」勾了，但只选了骨架、没选人物网格。

正确做法：

1. 在 Outliner 里**同时选中人物网格 + 它的 Armature**（Shift 点选），最后把网格设为活动物体；
2. 导出格式用 **glTF Binary (.glb)**，不要 `.gltf Separate`（会散成 .gltf + .bin + 贴图一堆文件）；
3. 勾选 **网格 / 材质 / 骨架 / 蒙皮**；静态模型可以取消「动画」；
4. **不要**对骨架做 Apply Scale / Rotation（会破坏蒙皮的 inverse bind matrix，模型会炸开或缩成球）；
5. 网页预算：**≤ 2.5 万三角面、贴图 ≤ 1024、导出后 ≤ 3 MB**。

一键导出（自动找骨架、减面、缩贴图、转 WebP）：

```bash
blender -b joe04.blend -P tools/blender/export_player.py -- player.glb 25000 1024
```

![球员模型压到 2.5 万面后的效果](docs/screenshot-player-model.png)

> 示例角色原始是 **50 万面 + 4K 贴图（导出 51 MB）**，用上面脚本压到 **2.5 万面 / 1.6 MB** 后
> 网页里才跑得动。注意它默认是 **T-pose**：进游戏必须播动画，
> 否则会站着张手（本项目尚未接动画混合器，下一步可以接）。

### 模型怎么接进游戏

| 资产 | 放哪里 | 说明 |
|---|---|---|
| 头盔 | `public/models/helmet.glb` | 已接入，自动缩放到头围 0.62yd、按球队主色给外壳调色 |
| 全身球员 | `public/models/player.glb` | 把 `src/config.ts` 的 `PLAYER_MODEL_URL` 改成 `'./models/player.glb'`，自动归一到 1.92yd 身高、脚底贴地、正面朝 +z |
| 替代头盔 | 任意 | URL 参数临时覆盖：`?player=./models/p1.glb&helmet=./models/h2.glb` |

球员模型建议 **T-pose 或 A-pose、正面朝 +z、脚底在 y=0**（loader 也会按包围盒自动纠正）。
静态模型运行时会用轻微起伏代替跑动动画；想要真正的跑步动作，需要给模型绑骨骼并在 Blender/Mixamo 里做动画，再导出带 animation 的 glb（本项目暂未接动画混合器）。

> 仓库里的 `assets-source/stadium-arena.glb` 是一个**封闭式体育馆**（四面高墙 + 顶棚），相机在里面一定会被墙挡住，所以**默认不加载**，也不进入离线包。
> 现在的看台是程序化生成的开放式碗形（只放在远端和两侧，近端留空），任何缩放档位都不会挡镜头。
> 如果要用 Tripo 重做球场，请生成**开放式碗形、中心是空场地、四周看台向外升高**的模型，再按 `src/three/stadium.ts` 里 `loadStadium()` 的注释接入。

---

## 6. 项目结构

```
src/
├── core/        types.ts（类型+状态）/ stateMachine.ts（状态机，纯逻辑）
├── gameplay/    routes / ballPhysics / catchJudge / routeRunner / playDirector（纯逻辑，可单测）
├── data/        plays.ts（战术库）/ cards.ts（球员卡+抽卡）/ storage.ts（localStorage）
├── three/       dimensions / scene（球场+球员+天空）/ stadium（看台+模型加载）/ camera / renderer
├── ui/          playCall（战术菜单）/ gestures（轻点vs长按）/ modals / sideButtons
├── pwa.ts       Service Worker 注册 + 更新提示
├── config.ts    模型路径配置（可用 URL 参数覆盖）
└── main.ts      装配：状态机 ↔ 渲染 ↔ 手势 ↔ UI
```

游戏逻辑（`gameplay/`、`core/`）与渲染彻底分离，全部可单元测试；渲染层只做画面同步。

---

## 7. 性能与适配

- 画质：高 = 设备像素比（≤1.75）；低 = 1x。设置里可切换，**连续掉帧时会自动降档一次**并记住。
- 人群用 `InstancedMesh`（1 个 draw call），看台合并成 1 个网格，球场地贴 1 张 canvas 纹理。
- 页面切到后台会暂停渲染，回来不会瞬移。
- 安全区：`env(safe-area-inset-*)` 已处理刘海屏/圆角屏，横竖屏都可玩，竖屏顶部有「横屏体验更佳」提示（可关闭）。
- WebGL 2 不可用时会显示友好提示而不是白屏。

## 8. 已知限制 / 路线图

- [ ] 球员骨骼动画（当前是几何体摆臂 + 静态模型起伏）
- [ ] 防守球员 AI（现在是随机站位 + 接球点判定）
- [ ] 多外接手 + 滑动选择传球目标
- [ ] 音效/背景乐（音量设置已预留）
- [ ] 商城实装：球衣颜色/装备/球场主题
- [ ] 完整比赛模式：档数推进、达阵计分

## 9. 资产许可

- `public/models/helmet.glb`：Poly Pizza（CC0）
- `assets-source/stadium-arena.glb`：Poly Pizza（CC0），当前不参与渲染、不进入离线包
- 其余球场/球员/UI 均为程序化生成，无第三方版权风险
