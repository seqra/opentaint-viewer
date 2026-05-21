import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// Exclude <option> elements from getByText queries because option text is
// rendered as part of a native <select> widget, not as visible page content.
configure({ defaultIgnore: 'script, style, option' });
