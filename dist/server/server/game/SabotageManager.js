import { SABOTAGE_FIX_LOCATIONS, INTERACTION_DISTANCES } from '../../shared/constants.js';
export class SabotageManager {
    state = {
        active: null,
        timeLeft: 0,
        meltdownFix: {
            reactorActive: false,
            lifeSupportActive: false
        },
        blackoutSwitches: [false, false, false, false, false]
    };
    sabotageCooldown = 15; // Initial warmup cooldown
    cooldownInterval = null;
    getState() {
        return this.state;
    }
    getCooldown() {
        return this.sabotageCooldown;
    }
    updateCooldown(deltaSec) {
        if (this.sabotageCooldown > 0 && !this.state.active) {
            this.sabotageCooldown = Math.max(0, this.sabotageCooldown - deltaSec);
        }
    }
    trigger(type) {
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
    tick(deltaSec) {
        if (this.state.active === 'meltdown') {
            this.state.timeLeft -= deltaSec;
            if (this.state.timeLeft <= 0) {
                this.state.timeLeft = 0;
                return 'MELTDOWN_CRITICAL';
            }
        }
        return null;
    }
    applyFixStep(playerX, playerY, fixType, switchIndex) {
        if (!this.state.active)
            return false;
        if (this.state.active === 'meltdown') {
            if (fixType === 'meltdown_reactor') {
                const dist = Math.hypot(playerX - SABOTAGE_FIX_LOCATIONS.meltdownReactor.x, playerY - SABOTAGE_FIX_LOCATIONS.meltdownReactor.y);
                if (dist <= INTERACTION_DISTANCES.SABOTAGE_FIX + 40) {
                    this.state.meltdownFix.reactorActive = true;
                }
            }
            else if (fixType === 'meltdown_lifesupport') {
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
        }
        else if (this.state.active === 'blackout' && fixType === 'blackout_switch') {
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
    clearSabotage() {
        this.state.active = null;
        this.state.timeLeft = 0;
        this.state.meltdownFix = { reactorActive: false, lifeSupportActive: false };
        this.state.blackoutSwitches = [false, false, false, false, false];
        this.sabotageCooldown = 30; // 30s cooldown before next sabotage
    }
}
