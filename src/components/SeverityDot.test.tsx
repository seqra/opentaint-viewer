import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SeverityDot } from './SeverityDot';

afterEach(cleanup);

describe('SeverityDot', () => {
  it('renders a decorative dot', () => {
    const { getByTestId } = render(<SeverityDot severity="warning" />);
    expect(getByTestId('severity-dot')).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses a distinct class per severity', () => {
    const { getByTestId: getError } = render(<SeverityDot severity="error" />);
    const error = getError('severity-dot').className;
    cleanup();
    const { getByTestId: getWarning } = render(<SeverityDot severity="warning" />);
    const warning = getWarning('severity-dot').className;
    cleanup();
    const { getByTestId: getNote } = render(<SeverityDot severity="note" />);
    const note = getNote('severity-dot').className;
    expect(new Set([error, warning, note]).size).toBe(3);
  });
});
