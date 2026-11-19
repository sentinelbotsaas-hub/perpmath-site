import { describe, expect, it } from 'vitest';
import { leverageFigure } from './format';

describe('leverageFigure', () => {
  it('splits a number from a unit that follows a space', () => {
    expect(leverageFigure('{n} 倍', 20, '無')).toEqual({ value: '20', unit: '倍' });
  });

  it('keeps a template without a space in one piece', () => {
    expect(leverageFigure('{n}x', 20, 'None')).toEqual({ value: '20x' });
  });

  it('prints the fallback when there is no leverage', () => {
    expect(leverageFigure('{n} 倍', null, '無')).toEqual({ value: '無' });
  });
});
