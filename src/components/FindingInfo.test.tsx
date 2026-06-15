import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FindingInfo } from './FindingInfo';
import { useStore } from '../state/store';
import { loadContent } from '../content/loadContent';

const content = loadContent();
const finding = content.findings[0];

describe('FindingInfo', () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().loadContent(content);
  });

  it('shows the report message, vuln class and location', () => {
    render(<FindingInfo />);
    expect(screen.getByText(finding.message)).toBeInTheDocument();
    expect(screen.getByText(finding.vulnClass)).toBeInTheDocument();
    if (finding.location) expect(screen.getByText(finding.location)).toBeInTheDocument();
  });

  it('links the rule id and opens the rule, anchored to it, when clicked', async () => {
    render(<FindingInfo />);
    await userEvent.click(screen.getByRole('button', { name: finding.ruleId }));
    expect(useStore.getState().activeRuleId).toBe(finding.ruleFile);
    expect(useStore.getState().activeRuleAnchor).toBe(finding.ruleId);
    expect(useStore.getState().activeTab).toBe('rules');
  });

  it('renders the full markdown description from the report', () => {
    render(<FindingInfo />);
    const firstWord = finding.description!.trim().split(/\s+/)[0];
    expect(screen.getByTestId('finding-info').textContent).toContain(firstWord);
  });

  it('shows a "definition not available" marker (no link) when the rule file is missing', () => {
    const noRule = {
      ...content,
      findings: content.findings.map((f, i) => (i === 0 ? { ...f, ruleFile: null } : f)),
    };
    useStore.getState().reset();
    useStore.getState().loadContent(noRule);
    render(<FindingInfo />);
    const f0 = noRule.findings[0];
    expect(screen.queryByRole('button', { name: f0.ruleId })).toBeNull();
    expect(screen.getByText(/definition not available/)).toBeInTheDocument();
    expect(screen.getByTestId('finding-info').textContent).toContain(f0.ruleId);
    expect(screen.getByText(f0.message)).toBeInTheDocument();
  });
});
