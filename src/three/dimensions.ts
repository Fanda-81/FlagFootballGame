/**
 * 场地尺寸常量（单位：码）。
 * 单独成文件，避免 scene.ts ↔ stadium.ts 互相 import 形成循环依赖。
 */
export const FIELD_LENGTH = 50; // 开球线（z=0）到远端球门线（z=50）
export const FIELD_WIDTH = 26.7; // 场地宽度（x 方向）
export const ENDZONE_DEPTH = 5; // 每侧端区深度
/** 含两端端区的总纵深（z ∈ [-5, 55]） */
export const FIELD_TOTAL_LENGTH = FIELD_LENGTH + ENDZONE_DEPTH * 2;
export const HALF_WIDTH = FIELD_WIDTH / 2;
/** 场地中圈（z 中点），相机默认看向这里 */
export const FIELD_MID_Z = FIELD_LENGTH / 2;
