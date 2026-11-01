/**
 * 静态模型路径配置：改这里即可替换美术资产，无需动渲染逻辑。
 * 也支持 URL 参数临时覆盖，方便在手机上直接试模型：
 *   ?player=./models/player.glb&helmet=./models/helmet-v2.glb
 */
const params = new URLSearchParams(location.search);

/** 全身球员模型（Tripo/Mixamo 导出的 glb，正面朝 +z、身高自动归一化）。null = 用几何球员 */
export const PLAYER_MODEL_URL: string | null = params.get('player');
/** 只替换 QB 的模型（用于试装/对比），优先于 PLAYER_MODEL_URL */
export const QB_MODEL_URL: string | null = params.get('qb') ?? './models/qb.glb';
/** 头盔模型路径 */
export const HELMET_MODEL_URL: string = params.get('helmet') ?? './models/helmet.glb';

/** 动作库（跑步/接球/传球/待机，只含骨架不含网格） */
export const ANIMS_URL: string = params.get('anims') ?? './models/anims.glb';

/** 离线包需要缓存的资源（代码/图标由 Service Worker 预缓存，这里只列模型） */
export function offlineAssets(): string[] {
  const urls = [HELMET_MODEL_URL, ANIMS_URL];
  if (PLAYER_MODEL_URL) urls.push(PLAYER_MODEL_URL);
  if (QB_MODEL_URL) urls.push(QB_MODEL_URL);
  return urls;
}
