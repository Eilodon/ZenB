import { describe, it, expect } from 'vitest';
import { createDisplaySnapshot } from './display';

describe('display classification', () => {
  it('classifies common mobile portrait viewport', () => {
    const s = createDisplaySnapshot({ width: 390, height: 844 });
    expect(s.orientation).toBe('portrait');
    expect(s.aspectBucket).toBe('ultra-tall');
    expect(s.sizeBucket).toBe('sm');
    expect(s.profile).toBe('portrait:ultra-tall:sm');
  });

  it('classifies iPad-like portrait viewport', () => {
    const s = createDisplaySnapshot({ width: 768, height: 1024 });
    expect(s.orientation).toBe('portrait');
    expect(s.aspectBucket).toBe('classic');
    expect(s.sizeBucket).toBe('lg');
    expect(s.profile).toBe('portrait:classic:lg');
  });

  it('classifies desktop wide viewport', () => {
    const s = createDisplaySnapshot({ width: 1440, height: 900 });
    expect(s.orientation).toBe('landscape');
    expect(s.aspectBucket).toBe('wide');
    expect(s.sizeBucket).toBe('xl');
    expect(s.profile).toBe('landscape:wide:xl');
  });

  it('classifies ultra-wide viewport', () => {
    const s = createDisplaySnapshot({ width: 2560, height: 1080 });
    expect(s.orientation).toBe('landscape');
    expect(s.aspectBucket).toBe('ultra-wide');
    expect(s.sizeBucket).toBe('xl');
    expect(s.profile).toBe('landscape:ultra-wide:xl');
  });
});

