/**
 * 静态模型路径配置：改这里即可替换美术资产，无需动渲染逻辑。
 * 也支持 URL 参数临时覆盖，方便在手机上直接试模型：
 *   ?player=./models/player.glb&helmet=./models/helmet-v2.glb
 */
const params = new URLSearchParams(location.search);

/** 全身球员模型（Tripo/Mixamo 导出的 glb，正面朝 +z、身高自动归一化）。null = 用几何球员 */
export const PLAYER_MODEL_URL: string | null = params.get('player');
/** 头盔模型路径 */
export const HELMET_MODEL_URL: string = params.get('helmet') ?? './models/helmet.glb';
