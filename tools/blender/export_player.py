"""
把 Blender 里的「骨架 + 蒙皮网格」一键导成网页可用的 GLB。

用法：
  blender -b 你的文件.blend -P tools/blender/export_player.py -- 输出.glb [目标三角面数] [贴图边长]

例：
  blender -b joe04.blend -P tools/blender/export_player.py -- player.glb 25000 1024

做的事：
  1. 自动找出所有带 Armature 修改器的网格，以及它们的骨架；
  2. 按面数比例做 Decimate（减面），并把修改器放到骨架修改器之前；
  3. 大于目标边长的贴图缩到目标边长；
  4. 只导出「网格 + 骨架」，保留蒙皮与动画，贴图导出为 WebP 控制体积。

注意：不要对骨架 Apply Scale / Rotation，否则蒙皮（inverse bind matrix）会错位。
"""
import bpy
import sys
import os

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if not argv:
    raise SystemExit('用法: blender -b x.blend -P export_player.py -- out.glb [tris] [texpx]')

out = os.path.abspath(argv[0])
target_tris = int(argv[1]) if len(argv) > 1 else 25000
tex_px = int(argv[2]) if len(argv) > 2 else 1024

# ---- 1. 找蒙皮网格与骨架 ----
skinned = [
    o for o in bpy.context.scene.objects
    if o.type == 'MESH' and any(m.type == 'ARMATURE' and m.object for m in o.modifiers)
]
if not skinned:
    raise SystemExit('没有找到带骨架修改器的网格：请确认网格已绑定到 Armature')

armatures = {
    m.object for o in skinned for m in o.modifiers
    if m.type == 'ARMATURE' and m.object
}
total_polys = sum(len(o.data.polygons) for o in skinned) or 1
print(f'[export] skinned meshes={len(skinned)} armatures={len(armatures)} polys={total_polys}')

# ---- 2. 减面 ----
for o in skinned:
    o.data.validate(verbose=False)
    share = len(o.data.polygons) / total_polys
    want = max(1000, int(target_tris * share))
    ratio = min(1.0, want / max(1, len(o.data.polygons)))
    if ratio >= 0.999:
        continue
    mod = o.modifiers.new('WebDecimate', 'DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = ratio
    mod.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_move_to_index(modifier=mod.name, index=0)
    print(f'[export] decimate {o.name}: {len(o.data.polygons)} -> ~{want} (ratio {ratio:.4f})')

# ---- 3. 贴图降分辨率 ----
for img in bpy.data.images:
    if img.size[0] > tex_px or img.size[1] > tex_px:
        img.scale(tex_px, tex_px)
        print(f'[export] resize texture {img.name} -> {img.size[0]}x{img.size[1]}')

# ---- 4. 只导出网格 + 骨架 ----
bpy.ops.object.select_all(action='DESELECT')
for o in skinned:
    o.select_set(True)
for a in armatures:
    a.select_set(True)
bpy.context.view_layer.objects.active = list(armatures)[0]

bpy.ops.export_scene.gltf(
    filepath=out,
    export_format='GLB',
    use_selection=True,
    export_apply=True,          # 应用 Decimate，但保留 Armature
    export_yup=True,
    export_texcoords=True,
    export_normals=True,
    export_materials='EXPORT',
    export_skins=True,
    export_animations=True,
    export_force_sampling=True,
    export_image_format='WEBP',
    export_image_quality=85,
)
print(f'[export] OK -> {out} ({os.path.getsize(out) / 1e6:.2f} MB)')
