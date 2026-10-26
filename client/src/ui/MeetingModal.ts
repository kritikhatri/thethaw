import { ChatMessage, MeetingState, PlayerPublic } from '@shared/types';
import { SoundSynthesizer } from '../assets/SoundSynthesizer.js';

export class MeetingModal {
  private static container: HTMLElement | null = null;
  private static myPlayerId: string = '';
  private static onVoteCallback: ((targetId: string) => void) | null = null;
  private static onChatCallback: ((text: string) => void) | null = null;
  private static hasVoted: boolean = false;

  public static init(container: HTMLElement, myId: string): void {
    this.container = container;
    this.myPlayerId = myId;
  }

  public static update(
    meeting: MeetingState | null,
    players: Record<string, PlayerPublic>,
    messages: ChatMessage[],
    onVote: (targetId: string) => void,
    onChat: (text: string) => void
  ): void {
    if (!this.container) return;

    if (!meeting || !meeting.active) {
      if (this.container.innerHTML !== '') {
        this.container.innerHTML = '';
        this.container.className = '';
        this.hasVoted = false;
      }
      return;
    }

    this.onVoteCallback = onVote;
    this.onChatCallback = onChat;
    this.container.className = 'interactive';

    const myPlayer = players[this.myPlayerId];
    const amAlive = myPlayer ? myPlayer.status === 'ALIVE' : false;
    const isVotingPhase = meeting.phase === 'VOTING';
    const isEjectionPhase = meeting.phase === 'EJECTION';

    if (isEjectionPhase) {
      this.renderEjectionScreen(meeting);
      return;
    }

    // Render discussion/voting interface
    const headerTitle = meeting.reason === 'body_reported'
      ? `🚨 DEAD BODY REPORTED BY ${meeting.reporterName.toUpperCase()}`
      : `⚠️ EMERGENCY MEETING CALLED BY ${meeting.reporterName.toUpperCase()}`;

    const timerLabel = meeting.phase === 'DISCUSSION'
      ? `DISCUSSION: ${meeting.timeLeft}s`
      : `VOTING TIME: ${meeting.timeLeft}s`;

    let html = `
      <div style="position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(3, 7, 18, 0.95); backdrop-filter:blur(8px); display:flex; flex-direction:column; padding:24px; box-sizing:border-box; user-select:none; z-index:100;">
        <!-- Meeting Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #1e293b; padding-bottom:14px; margin-bottom:18px;">
          <div>
            <h2 style="color:${meeting.reason === 'body_reported' ? '#f87171' : '#38bdf8'}; font-size:22px; letter-spacing:1px; margin-bottom:4px;">${headerTitle}</h2>
            <div style="color:#94a3b8; font-size:13px;">Review alibis, discuss suspicious activity, and cast your vote.</div>
          </div>
          <div style="background:#0f172a; border:2px solid ${isVotingPhase ? '#facc15' : '#38bdf8'}; padding:10px 20px; border-radius:8px; font-family:monospace; font-size:18px; font-weight:bold; color:#f8fafc; box-shadow:0 0 15px rgba(56, 189, 248, 0.3);">
            ${timerLabel}
          </div>
        </div>

        <!-- Main Body: Players Grid on Left, Chat on Right -->
        <div style="display:flex; flex:1; gap:20px; min-height:0;">
          <!-- Left: Suspect Cards -->
          <div style="flex:1.2; display:flex; flex-direction:column; overflow-y:auto; gap:12px; padding-right:6px;">
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:12px;">
    `;

    for (const p of Object.values(players)) {
      const isAlive = p.status === 'ALIVE';
      const isMe = p.id === this.myPlayerId;
      const hasVotedThisPlayer = !!meeting.votes[p.id];
      const cardBorder = isMe ? '#38bdf8' : '#334155';

      html += `
        <div style="background:#0f172a; border:1px solid ${cardBorder}; border-radius:8px; padding:12px; display:flex; align-items:center; justify-content:space-between; opacity:${isAlive ? '1' : '0.45'};">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:24px; height:24px; border-radius:50%; background:${p.colorHex}; box-shadow:0 0 8px ${p.colorHex}; border:2px solid #0f172a;"></div>
            <div>
              <div style="color:#f8fafc; font-weight:bold; font-size:14px;">${p.name} ${isMe ? '(You)' : ''}</div>
              <div style="color:${isAlive ? '#4ade80' : '#f87171'}; font-size:11px; font-family:monospace;">
                ${isAlive ? (hasVotedThisPlayer ? '✓ VOTED' : 'CONSIDERING') : '✕ DECEASED'}
              </div>
            </div>
          </div>
          ${isVotingPhase && amAlive && isAlive && !this.hasVoted ? `
            <button class="vote-player-btn" data-id="${p.id}" style="background:#dc2626; color:#ffffff; border:none; border-radius:6px; padding:6px 14px; font-size:12px; font-weight:bold; cursor:pointer; box-shadow:0 0 8px rgba(220, 38, 38, 0.4);">
              VOTE
            </button>
          ` : ''}
        </div>
      `;
    }

    html += `
            </div>
            <!-- Skip Vote Button -->
            ${isVotingPhase && amAlive && !this.hasVoted ? `
              <div style="margin-top:auto; padding-top:12px; display:flex; justify-content:flex-end;">
                <button id="skip-vote-btn" style="background:#475569; color:#f8fafc; border:none; border-radius:6px; padding:10px 24px; font-weight:bold; font-size:14px; cursor:pointer; box-shadow:0 0 10px rgba(71, 85, 105, 0.4);">
                  SKIP VOTE
                </button>
              </div>
            ` : ''}
            ${this.hasVoted ? `
              <div style="margin-top:auto; padding-top:12px; text-align:center; color:#4ade80; font-family:monospace; font-size:14px;">
                ✓ VOTE RECORDED. WAITING FOR OTHER SCIENTISTS...
              </div>
            ` : ''}
          </div>

          <!-- Right: Live Meeting Chat -->
          <div style="flex:1; background:#0f172a; border:1px solid #1e293b; border-radius:8px; display:flex; flex-direction:column; padding:12px;">
            <div style="border-bottom:1px solid #1e293b; padding-bottom:8px; margin-bottom:8px; font-size:12px; font-weight:bold; color:#38bdf8; letter-spacing:1px;">
              STATION COMMUNICATIONS TRANSCRIPT
            </div>
            <div id="meeting-chat-messages" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:8px; padding-right:4px;">
    `;

    messages.forEach(m => {
      html += `
        <div style="font-size:13px; line-height:1.4; opacity:${m.isGhost ? '0.7' : '1'};">
          <span style="color:${m.senderColorHex}; font-weight:bold;">${m.isGhost ? '👻 [GHOST] ' : ''}${m.senderName}:</span>
          <span style="color:#e2e8f0; margin-left:4px;">${this.escapeHtml(m.text)}</span>
        </div>
      `;
    });

    html += `
            </div>
            <form id="meeting-chat-form" style="display:flex; gap:8px; margin-top:8px;">
              <input id="meeting-chat-input" type="text" placeholder="${amAlive ? 'Type your deduction...' : 'Ghost chat (only visible to dead)...'}" maxlength="160" style="flex:1; background:#1e293b; border:1px solid #334155; border-radius:6px; padding:8px 12px; color:#f8fafc; font-size:13px; outline:none;" />
              <button type="submit" style="background:#0284c7; color:#ffffff; border:none; border-radius:6px; padding:8px 16px; font-weight:bold; cursor:pointer;">SEND</button>
            </form>
          </div>
        </div>
      </div>
    `;

    this.container.innerHTML = html;

    // Attach vote listeners
    this.container.querySelectorAll('.vote-player-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = (btn as HTMLElement).dataset.id!;
        SoundSynthesizer.playVote();
        this.hasVoted = true;
        if (this.onVoteCallback) this.onVoteCallback(targetId);
      });
    });

    const skipBtn = this.container.querySelector('#skip-vote-btn');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        SoundSynthesizer.playVote();
        this.hasVoted = true;
        if (this.onVoteCallback) this.onVoteCallback('skip');
      });
    }

    // Attach chat form listener
    const chatForm = this.container.querySelector('#meeting-chat-form') as HTMLFormElement;
    const chatInput = this.container.querySelector('#meeting-chat-input') as HTMLInputElement;
    const chatMessagesEl = this.container.querySelector('#meeting-chat-messages') as HTMLElement;
    if (chatMessagesEl) {
      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    }

    if (chatForm && chatInput) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (text && this.onChatCallback) {
          SoundSynthesizer.playClick();
          this.onChatCallback(text);
          chatInput.value = '';
        }
      });
    }
  }

  private static renderEjectionScreen(meeting: MeetingState): void {
    if (!this.container) return;

    let text = '';
    let subtext = '';

    if (meeting.ejectedId === 'tie') {
      text = 'Voting resulted in a tie.';
      subtext = 'No scientist was ejected.';
    } else if (meeting.ejectedId === 'skip') {
      text = 'The crew chose to skip the vote.';
      subtext = 'No scientist was ejected.';
    } else {
      text = `${meeting.ejectedName} was ejected into the freezing vacuum.`;
      if (meeting.wasSaboteur !== undefined) {
        subtext = meeting.wasSaboteur ? 'They were a Saboteur.' : 'They were not a Saboteur.';
      }
    }

    this.container.innerHTML = `
      <div style="position:absolute; top:0; left:0; width:100%; height:100%; background:#020617; display:flex; flex-direction:column; align-items:center; justify-content:center; user-select:none; z-index:100; animation:fadeIn 0.5s ease;">
        <div style="font-size:24px; color:#f8fafc; font-weight:bold; letter-spacing:1px; margin-bottom:12px; text-align:center;">
          ${text}
        </div>
        <div style="font-size:18px; color:${meeting.wasSaboteur ? '#f87171' : '#38bdf8'}; font-family:monospace; text-align:center;">
          ${subtext}
        </div>
      </div>
    `;
  }

  private static escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, (m) => {
      switch (m) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        default: return '&#039;';
      }
    });
  }
}
