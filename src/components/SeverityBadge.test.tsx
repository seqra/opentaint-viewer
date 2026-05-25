import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SeverityBadge } from './SeverityBadge';

describe('SeverityBadge', () => {
  it('renders the severity label', () => {
    render(<SeverityBadge severity="warning" />);
    expect(screen.getByTestId('severity-badge')).toHaveTextContent('Warning');
  });
});
