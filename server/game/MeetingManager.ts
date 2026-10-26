import { MeetingPhase, MeetingState, Role } from '../../shared/types.js';

export class MeetingManager {
  private state: MeetingState | null = null;
  private timer: number = 0;
  private discussionSec: number;
  private votingSec: number;

  constructor(discussionSec = 15, votingSec = 20) {
    this.discussionSec = discussionSec;
    this.votingSec = votingSec;
  }

  public isActive(): boolean {
    return this.state !== null && this.state.active;
  }

  public getState(): MeetingState | null {
    return this.state;
  }

  public startMeeting(
    reason: 'emergency_button' | 'body_reported',
    reporterId: string,
    reporterName: string,
    victimName?: string
  ): MeetingState {
    this.state = {
      active: true,
      reason,
      reporterId,
      reporterName,
      victimName,
      phase: 'DISCUSSION',
      timeLeft: this.discussionSec,
      votes: {}
    };
    this.timer = this.discussionSec;
    return this.state;
  }

  public recordVote(voterId: string, targetId: string): boolean {
    if (!this.state || this.state.phase !== 'VOTING') {
      return false;
    }
    // Only allow voting once
    if (this.state.votes[voterId]) {
      return false;
    }
    this.state.votes[voterId] = targetId;
    return true;
  }

  /**
   * Tick meeting timer and progress phases
   * Returns event string when phase changes or meeting concludes
   */
  public tick(
    deltaSec: number,
    alivePlayerIds: string[],
    players: Record<string, { name: string; role?: Role }>
  ): {
    phaseChanged: boolean;
    finished: boolean;
    ejectedId?: string;
    ejectedName?: string;
    ejectedRole?: Role;
  } {
    if (!this.state || !this.state.active) {
      return { phaseChanged: false, finished: false };
    }

    this.timer -= deltaSec;
    this.state.timeLeft = Math.max(0, Math.ceil(this.timer));

    // Check if everyone alive has voted during VOTING phase
    if (this.state.phase === 'VOTING') {
      const allVoted = alivePlayerIds.every(id => !!this.state?.votes[id]);
      if (allVoted || this.timer <= 0) {
        // Transition to RESULTS / EJECTION
        return this.processVotes(players);
      }
    }

    if (this.timer <= 0) {
      if (this.state.phase === 'DISCUSSION') {
        this.state.phase = 'VOTING';
        this.timer = this.votingSec;
        this.state.timeLeft = this.votingSec;
        return { phaseChanged: true, finished: false };
      } else if (this.state.phase === 'EJECTION') {
        // Meeting is completely finished
        const ejectedId = this.state.ejectedId;
        const ejectedName = this.state.ejectedName;
        const ejectedRole = this.state.ejectedRole;
        this.state = null;
        return { phaseChanged: false, finished: true, ejectedId, ejectedName, ejectedRole };
      }
    }

    return { phaseChanged: false, finished: false };
  }

  private processVotes(players: Record<string, { name: string; role?: Role }>) {
    if (!this.state) return { phaseChanged: false, finished: false };

    // Tally votes
    const counts: Record<string, number> = {};
    for (const targetId of Object.values(this.state.votes)) {
      counts[targetId] = (counts[targetId] || 0) + 1;
    }

    let highestId: string | null = null;
    let highestCount = 0;
    let isTie = false;

    for (const [targetId, count] of Object.entries(counts)) {
      if (count > highestCount) {
        highestCount = count;
        highestId = targetId;
        isTie = false;
      } else if (count === highestCount && highestCount > 0) {
        isTie = true;
      }
    }

    this.state.phase = 'EJECTION';
    this.timer = 5; // 5 seconds to display ejection text
    this.state.timeLeft = 5;

    if (isTie || !highestId || highestId === 'skip') {
      this.state.ejectedId = isTie ? 'tie' : 'skip';
      this.state.ejectedName = isTie ? 'Tie' : 'Skipped';
      return { phaseChanged: true, finished: false };
    }

    const ejectedPlayer = players[highestId];
    this.state.ejectedId = highestId;
    this.state.ejectedName = ejectedPlayer ? ejectedPlayer.name : 'Unknown';
    this.state.ejectedRole = ejectedPlayer ? ejectedPlayer.role : undefined;
    this.state.wasSaboteur = ejectedPlayer?.role === 'SABOTEUR';

    return {
      phaseChanged: true,
      finished: false,
      ejectedId: this.state.ejectedId,
      ejectedName: this.state.ejectedName,
      ejectedRole: this.state.ejectedRole
    };
  }

  public endMeeting(): void {
    this.state = null;
  }
}
