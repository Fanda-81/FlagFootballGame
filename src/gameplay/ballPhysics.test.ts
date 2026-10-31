import { describe, expect, it } from 'vitest';
import { APEX_M, BALL_SPEED, computeThrow, qbSpeedFactor } from './ballPhysics';

describe('ballPhysics', () => {
  it('反证#2：bullet 比 lob 更早到达同距离目标（20yd）', () => {
    const qb = { x: 0, z: -3 };
    const target = { x: 0, z: 17 };
    const bullet = computeThrow(qb, target, 'bullet');
    const lob = computeThrow(qb, target, 'lob');
    expect(bullet.tFlight).toBeCloseTo(20 / BALL_SPEED.bullet, 6);
    expect(lob.tFlight).toBeCloseTo(20 / BALL_SPEED.lob, 6);
    expect(bullet.tFlight).toBeLessThan(lob.tFlight);
  });

  it('lob 弧线顶点高于 bullet', () => {
    const qb = { x: 0, z: -3 };
    const target = { x: 0, z: 17 };
    const bullet = computeThrow(qb, target, 'bullet');
    const lob = computeThrow(qb, target, 'lob');
    expect(bullet.heightAt(0.5)).toBeCloseTo(APEX_M.bullet, 6);
    expect(lob.heightAt(0.5)).toBeCloseTo(APEX_M.lob, 6);
    expect(lob.heightAt(0.5)).toBeGreaterThan(bullet.heightAt(0.5));
  });

  it('轨迹起点/终点插值正确', () => {
    const qb = { x: 1, z: -3 };
    const target = { x: 5, z: 12 };
    const traj = computeThrow(qb, target, 'bullet');
    expect(traj.posAt(0)).toEqual({ x: 1, z: -3 });
    expect(traj.posAt(1)).toEqual({ x: 5, z: 12 });
    expect(traj.posAt(0.5)).toEqual({ x: 3, z: 4.5 });
    expect(traj.heightAt(0)).toBe(0);
    expect(traj.heightAt(1)).toBe(0);
  });

  it('QB 传球力量系数：THP 99→1.1，THP 0→0.9', () => {
    expect(qbSpeedFactor({ THP: 99, TAC: 80, SPD: 70, AWR: 80 })).toBeCloseTo(1.1, 6);
    expect(qbSpeedFactor({ THP: 0, TAC: 80, SPD: 70, AWR: 80 })).toBeCloseTo(0.9, 6);
    expect(qbSpeedFactor()).toBe(1.0);
  });
});
