import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FindingInfo } from './FindingInfo';
import { useStore } from '../state/store';
import { loadContent } from '../content/loadContent';

const content = loadContent();
const finding = content.findings.find((x) => x.id === content.scenarios[0].defaultFindingId)!;

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
});
