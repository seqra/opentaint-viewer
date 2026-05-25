import { describe, it, expect } from 'vitest';
import { fileTabLabel } from './fileTabLabel';

describe('fileTabLabel', () => {
  it('returns the basename when it is unique among the open files', () => {
    const all = ['src/main/UserController.java', 'src/main/UserRepository.java'];
    expect(fileTabLabel('src/main/UserController.java', all)).toBe('UserController.java');
  });

  it('disambiguates with the parent directory when basenames collide', () => {
    const all = ['src/main/Foo.java', 'src/test/Foo.java'];
    expect(fileTabLabel('src/main/Foo.java', all)).toBe('main/Foo.java');
    expect(fileTabLabel('src/test/Foo.java', all)).toBe('test/Foo.java');
  });

  it('handles a bare filename with no directory', () => {
    expect(fileTabLabel('A.java', ['A.java', 'B.java'])).toBe('A.java');
  });
});
