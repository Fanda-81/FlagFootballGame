/**
 * 一键发布：构建 dist/ → 用临时 worktree 把它推到 origin 的 gh-pages 分支。
 * GitHub Pages 设为「Deploy from a branch → gh-pages / (root)」后，每次运行本脚本即上线。
 *
 * 用法：npm run deploy
 * 说明：不依赖 GitHub Actions，因此不需要 token 的 workflow 权限；
 *      推送沿用本机 git 凭据（Git Credential Manager）与 origin 配置。
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const tmp = join(root, '.deploy-tmp');

function sh(cmd, cwd = root) {
  execSync(cmd, { cwd, stdio: 'inherit', shell: true });
}

console.log('▶ 构建…');
sh('npm run build');

if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });

console.log('▶ 准备 gh-pages…');
sh(`git worktree add --detach "${tmp}"`);
try {
  sh('git checkout --orphan gh-pages', tmp);
  sh('git rm -rf . --quiet', tmp);
  cpSync(join(root, 'dist'), tmp, { recursive: true });
  // GitHub Pages 默认走 Jekyll，加 .nojekyll 避免下划线开头的资源被忽略
  writeFileSync(join(tmp, '.nojekyll'), '');
  sh('git add -A', tmp);
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  sh(`git -c user.name="ffp-deploy" -c user.email="deploy@local" commit -m "deploy: ${stamp}" --quiet`, tmp);
  console.log('▶ 推送到 origin/gh-pages…');
  sh('git push --force origin gh-pages', tmp);
  console.log('\n✅ 已发布（GitHub Pages 生效通常需要 30~90 秒）');
} finally {
  rmSync(tmp, { recursive: true, force: true });
  sh('git worktree prune');
}
