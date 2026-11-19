import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFoodOfflineFallback } from './nutritionFallback';

describe('analyzeFoodOfflineFallback', () => {
  it('recognizes high-protein Indonesian meal prep accurately', () => {
    const res = analyzeFoodOfflineFallback('Nasi merah, dada ayam bakar & tumis brokoli', false);
    assert.equal(res.is_food, true);
    assert.ok(res.protein_g >= 40, `Expected high protein, got ${res.protein_g}`);
    assert.ok(res.health_score >= 8);
    assert.ok(res.ingredients_breakdown.length >= 3);
  });

  it('recognizes Nasi Padang Rendang with higher calories and fat', () => {
    const res = analyzeFoodOfflineFallback('Nasi Padang Rendang Sapi', false);
    assert.equal(res.is_food, true);
    assert.ok(res.calories_kcal >= 700);
    assert.ok(res.fat_g >= 25);
  });

  it('rejects non-food objects honestly when no image is provided', () => {
    const res = analyzeFoodOfflineFallback('Sepatu lari Nike', false);
    assert.equal(res.is_food, false);
    assert.equal(res.calories_kcal, 0);
    assert.equal(res.health_score, 0);
    assert.ok(res.non_food_reason && res.non_food_reason.length > 0);
  });

  it('returns balanced fallback for generic Indonesian food or image-only uploads', () => {
    const res = analyzeFoodOfflineFallback('', true);
    assert.equal(res.is_food, true);
    assert.ok(res.calories_kcal > 0);
    assert.ok(res.local_indonesian_tips.length > 0);
  });
});
