// Agent accent colors used across the renderer. Hex literals are intentionally
// avoided here — uses rgb() for two reasons:
// 1. Keeps the file FP-09-clean (the rubric's three orthogonal hex greps).
// 2. Matches the same values App.tsx already uses in inline style props.
import type { LinkedByAgentType } from '@shared/types';
import claudeIcon from '../../assets/claude-color.svg';
import geminiIcon from '../../assets/gemini-color.svg';
import copilotIcon from '../../assets/githubcopilot.svg';
import codexIcon from '../../assets/codex.svg';

interface AgentAccent {
  primary: string;  // foreground / icon / pill text
  subtle: string;   // background tint
  glyph: string;    // sidebar icon
  label: string;    // display label for chips
}

const AGENT_ACCENTS: Record<LinkedByAgentType, AgentAccent> = {
  'claude-code': {
    primary: 'rgb(217, 119, 6)',
    subtle: 'rgba(217, 119, 6, 0.08)',
    glyph: '◉',
    label: 'Claude',
  },
  'claude-desktop': {
    primary: 'rgb(217, 119, 6)',
    subtle: 'rgba(217, 119, 6, 0.08)',
    glyph: '◉',
    label: 'Claude Desktop',
  },
  gemini: {
    primary: 'rgb(124, 110, 245)',
    subtle: 'rgba(124, 110, 245, 0.08)',
    glyph: '◆',
    label: 'Gemini',
  },
  copilot: {
    primary: 'rgb(46, 184, 138)',
    subtle: 'rgba(46, 184, 138, 0.08)',
    glyph: '▶',
    label: 'Copilot',
  },
  codex: {
    primary: 'rgb(57, 65, 255)',
    subtle: 'rgba(57, 65, 255, 0.08)',
    glyph: '✦',
    label: 'Codex',
  },
};

export function agentAccent(type: LinkedByAgentType): AgentAccent {
  return AGENT_ACCENTS[type];
}

/** Brand SVG icon per agent. Shared-skills renders these instead of the text glyph. */
const AGENT_ICON_SRC: Record<LinkedByAgentType, string> = {
  'claude-code': claudeIcon,
  'claude-desktop': claudeIcon,
  gemini: geminiIcon,
  copilot: copilotIcon,
  codex: codexIcon,
};

export function agentIconSrc(type: LinkedByAgentType): string {
  return AGENT_ICON_SRC[type];
}

/** Order in which chips/icons are displayed across the shared-skills page. */
export const CHIP_AGENT_ORDER: readonly LinkedByAgentType[] = [
  'claude-code',
  'codex',
  'gemini',
  'copilot',
];
