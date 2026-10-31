import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FIELD_LENGTH } from './scene';

/**
 * 外部模型加载（Poly Pizza CC0 资产，local fallback 几何体）。
 * 所有模型按包围盒自动缩放对齐，加载失败静默返回 null。
 */

const loader = new GLTFLoader();

/** 包围盒辅助 */
function fitBox(obj: THREE.Object3D, targetWidth: number): THREE.Box3 {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = targetWidth / maxDim;
  obj.scale.setScalar(scale);
  const scaled = new THREE.Box3().setFromObject(obj);
  return scaled;
}

/**
 * 环形体育场：环绕球场一周（参考图效果）。
 * 环径 115yd、下沉 1.5yd：保证看台不遮挡球场视野与摄像机路径。
 */
export async function loadStadium(scene: THREE.Scene): Promise<THREE.Group | null> {
  try {
    const gltf = await loader.loadAsync('./models/stadium.glb');
    const obj = gltf.scene;
    const box = fitBox(obj, 115); // 环径 115yd（球场纵深 60yd + 看台 + 摄像机余量）
    const center = box.getCenter(new THREE.Vector3());
    obj.position.set(
      -center.x,
      -box.min.y - 1.5, // 整体下沉：看台顶低于摄像机默认视线
      FIELD_LENGTH / 2 - center.z,
    );
    obj.traverse((n) => {
      if ((n as THREE.Mesh).isMesh) n.castShadow = false;
    });
    scene.add(obj);
    return obj;
  } catch (e) {
    console.warn('[stadium] 体育场模型加载失败，跳过：', e);
    return null;
  }
}

/**
 * 橄榄球头盔模型：缩放至头围约 0.62yd。
 * 返回模板，调用方 clone 后挂到球员头部挂点。
 */
export async function loadHelmet(): Promise<THREE.Object3D | null> {
  try {
    const gltf = await loader.loadAsync('./models/helmet.glb');
    const obj = gltf.scene;
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 0.62 / maxDim;
    obj.scale.setScalar(scale);
    // 中心对齐到包围盒中心（挂点定位用）
    const center = box.getCenter(new THREE.Vector3());
    obj.position.sub(center.clone().multiplyScalar(scale));
    return obj;
  } catch (e) {
    console.warn('[helmet] 头盔模型加载失败，用几何体头盔：', e);
    return null;
  }
}
