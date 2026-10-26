import { SabotageState, SabotageType } from '../../shared/types.js';
import { SABOTAGE_FIX_LOCATIONS, INTERACTION_DISTANCES } from '../../shared/constants.js';

export class SabotageManager {
  private state: SabotageState = {
    active: null,
    timeLeft: 0,
    meltdownFix: {
      reactorActive: false,
      lifeSupportActive: false
    },
    blackoutSwitches: [false, false, false, false, false]
  };

  private sabotageCooldown = 15; // Initial warmup cooldown
  private cooldownInterval: NodeJS.Timeout | null = null;

  public getState(): SabotageState {
    return this.state;
  }

  public getCooldown(): number {
    return this.sabotageCooldown;
  }

  public updateCooldown(deltaSec: number): void {
    if (this.sabotageCooldown > 0 && !this.state.active) {
      this.sabotageCooldown = Math.max(0, this.sabotageCooldown - deltaSec);
    }
  }

  public trigger(type: SabotageType): boolean {
    if (this.state.active !== null || this.sabotageCooldown > 0) {
      return false;
    }

    if (type === 'meltdown') {
      this.state.active = 'meltdown';
      this.state.timeLeft = 45; // 45 seconds to meltdown
      this.state.meltdownFix = {
        reactorActive: false,
        lifeSupportActive: false
      };
      return true;
    }

    if (type === 'blackout') {
      this.state.active = 'blackout';
      this.state.timeLeft = 0;
      // 5 switches, randomize which ones start off (at least 3 off)
      this.state.blackoutSwitches = [false, false, false, false, false];
      return true;
    }

    return false;
  }

  public tick(deltaSec: number): 'MELTDOWN_CRITICAL' | null {
    if (this.state.active === 'meltdown') {
      this.state.timeLeft -= deltaSec;
      if (this.state.timeLeft <= 0) {
        this.state.timeLeft = 0;
        return 'MELTDOWN_CRITICAL';
      }
    }
    return null;
  }

  public applyFixStep(
    playerX: number,
    playerY: number,
    fixType: 'meltdown_reactor' | 'meltdown_lifesupport' | 'blackout_switch',
    switchIndex?: number
  ): boolean {
    if (!this.state.active) return false;

    if (this.state.active === 'meltdown') {
      if (fixType === 'meltdown_reactor') {
        const dist = Math.hypot(playerX - SABOTAGE_FIX_LOCATIONS.meltdownReactor.x, playerY - SABOTAGE_FIX_LOCATIONS.meltdownReactor.y);
        if (dist <= INTERACTION_DISTANCES.SABOTAGE_FIX + 40) {
          this.state.meltdownFix.reactorActive = true;
        }
      } else if (fixType === 'meltdown_lifesupport') {
        const dist = Math.hypot(playerX - SABOTAGE_FIX_LOCATIONS.meltdownLifeSupport.x, playerY - SABOTAGE_FIX_LOCATIONS.meltdownLifeSupport.y);
        if (dist <= INTERACTION_DISTANCES.SABOTAGE_FIX + 40) {
          this.state.meltdownFix.lifeSupportActive = true;
        }
      }

      // If both activated, meltdown is resolved!
      if (this.state.meltdownFix.reactorActive && this.state.meltdownFix.lifeSupportActive) {
        this.clearSabotage();
        return true;
      }
    } else if (this.state.active === 'blackout' && fixType === 'blackout_switch') {
      const dist = Math.hypot(playerX - SABOTAGE_FIX_LOCATIONS.electricalBreakers.x, playerY - SABOTAGE_FIX_LOCATIONS.electricalBreakers.y);
      if (dist <= INTERACTION_DISTANCES.SABOTAGE_FIX + 40 && switchIndex !== undefined && switchIndex >= 0 && switchIndex < 5) {
        this.state.blackoutSwitches[switchIndex] = !this.state.blackoutSwitches[switchIndex];
        // If all 5 switches are on (true), blackout is resolved!
        if (this.state.blackoutSwitches.every(s => s === true)) {
          this.clearSabotage();
          return true;
        }
      }
    }

    return false;
  }

  public clearSabotage(): void {
    this.state.active = null;
    this.state.timeLeft = 0;
    this.state.meltdownFix = { reactorActive: false, lifeSupportActive: false };
    this.state.blackoutSwitches = [false, false, false, false, false];
    this.sabotageCooldown = 30; // 30s cooldown before next sabotage
  }
}
