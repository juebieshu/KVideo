import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractEpisodeCount,
  extractSeason,
  normalizePeople,
  normalizeSynopsis,
  normalizeYear,
  parseMediaTitle,
} from '@/lib/media/normalize';
import { buildMediaKey, groupMedia } from '@/lib/media/group';
import type { Video } from '@/lib/types';

function makeVideo(overrides: {
  id: string | number;
  name: string;
  source: string;
  year?: string;
  type?: string;
  latency?: number;
  content?: string;
  actor?: string;
  director?: string;
  remarks?: string;
}): Video {
  return {
    vod_id: overrides.id,
    vod_name: overrides.name,
    source: overrides.source,
    vod_year: overrides.year,
    type_name: overrides.type,
    latency: overrides.latency,
    vod_content: overrides.content,
    vod_actor: overrides.actor,
    vod_director: overrides.director,
    vod_remarks: overrides.remarks,
  };
}

test('title normalization unifies traditional/simplified and strips noise', () => {
  const traditional = parseMediaTitle('[HD] 慶餘年 全46集 国语中字', '2019');
  const simplified = parseMediaTitle('庆余年', '2019');

  assert.equal(traditional.title, simplified.title);
  assert.equal(traditional.displayTitle, '庆余年');
  assert.equal(traditional.year, '2019');
});

test('year and season are extracted from the title when metadata is missing', () => {
  const parsed = parseMediaTitle('庆余年 第二季 (2024)');
  assert.equal(parsed.title, '庆余年');
  assert.equal(parsed.season, 2);
  assert.equal(parsed.year, '2024');

  assert.equal(extractSeason('Show Season 2'), 2);
  assert.equal(extractSeason('Show S02'), 2);
  assert.equal(extractSeason('第十二季'), 12);
  assert.equal(normalizeYear(2019), '2019');
  assert.equal(normalizeYear('2024-05-01'), '2024');
});

test('same title and year merge with high confidence', () => {
  const groups = groupMedia([
    makeVideo({ id: 1, name: '庆余年', source: 'a', year: '2019', type: '国产剧', latency: 80 }),
    makeVideo({ id: 2, name: '[HD] 庆余年 全46集 国语中字', source: 'b', year: '2019', type: '国产剧', latency: 120 }),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].confidence, 'high');
  assert.equal(groups[0].candidates.length, 2);
  assert.equal(groups[0].title, '庆余年');
  assert.equal(groups[0].key, buildMediaKey({ title: '庆余年', year: '2019' }));
});

test('same title but different year is never merged', () => {
  const groups = groupMedia([
    makeVideo({ id: 1, name: '同名电影', source: 'a', year: '2019', type: '电影' }),
    makeVideo({ id: 2, name: '同名电影', source: 'b', year: '2024', type: '电影' }),
  ]);

  assert.equal(groups.length, 2);
});

test('same title but different season is never merged', () => {
  const groups = groupMedia([
    makeVideo({ id: 1, name: '庆余年 第一季', source: 'a', year: '2019', type: '国产剧' }),
    makeVideo({ id: 2, name: '庆余年 第二季', source: 'b', year: '2024', type: '国产剧' }),
  ]);

  assert.equal(groups.length, 2);
});

test('type metadata does not block merging', () => {
  const groups = groupMedia([
    makeVideo({ id: 1, name: '长安十二时辰', source: 'a', year: '2019', type: '电影' }),
    makeVideo({ id: 2, name: '长安十二时辰', source: 'b', year: '2019', type: '国产剧' }),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].candidates.length, 2);
});

test('missing year merges as medium confidence', () => {
  const groups = groupMedia([
    makeVideo({ id: 1, name: '无年份剧集', source: 'a', type: '国产剧' }),
    makeVideo({ id: 2, name: '无年份剧集', source: 'b', type: '国产剧' }),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].confidence, 'medium');
});

test('conflicting known years split the missing-year candidate into its own group', () => {
  const groups = groupMedia([
    makeVideo({ id: 1, name: '长安十二时辰', source: 'a', year: '2019', type: '国产剧' }),
    makeVideo({ id: 2, name: '长安十二时辰', source: 'b', year: '2024', type: '国产剧' }),
    makeVideo({ id: 3, name: '长安十二时辰', source: 'c', type: '国产剧' }),
  ]);

  assert.equal(groups.length, 3);
  assert.equal(groups.filter((group) => group.confidence === 'medium').length, 1);
});

test('missing type metadata does not block merging', () => {
  const groups = groupMedia([
    makeVideo({ id: 1, name: '无类型来源', source: 'a', year: '2020', type: '电影' }),
    makeVideo({ id: 2, name: '无类型来源', source: 'b', year: '2020' }),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].confidence, 'high');
  assert.equal(groups[0].candidates.length, 2);
});

test('different titles never merge', () => {
  const groups = groupMedia([
    makeVideo({ id: 1, name: '庆余年', source: 'a', year: '2019', type: '国产剧' }),
    makeVideo({ id: 2, name: '庆余年2', source: 'b', year: '2019', type: '国产剧' }),
  ]);

  assert.equal(groups.length, 2);
});

const LONG_SYNOPSIS =
  '本剧讲述了一个普通少年在乱世中意外获得神秘力量，经历家族变故后踏上复仇与守护之路，并在旅途中结识挚友、揭开王朝隐秘真相的故事。';

test('synopsis normalization strips html and unifies traditional chinese', () => {
  assert.equal(normalizeSynopsis('<p>慶餘年 &amp; 故事</p>'), '庆余年故事');
});

test('different titles merge when synopses are identical and years match', () => {
  const groups = groupMedia([
    makeVideo({ id: 1, name: '甲剧', source: 'a', year: '2023', content: LONG_SYNOPSIS }),
    makeVideo({ id: 2, name: '乙剧', source: 'b', year: '2023', content: LONG_SYNOPSIS }),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].confidence, 'medium');
  assert.equal(groups[0].candidates.length, 2);
});

test('different titles merge when synopses are nearly identical', () => {
  const variant = `${LONG_SYNOPSIS}最终成长为一代宗师。`;
  const groups = groupMedia([
    makeVideo({ id: 1, name: '甲剧', source: 'a', year: '2023', content: LONG_SYNOPSIS }),
    makeVideo({ id: 2, name: '乙剧', source: 'b', year: '2023', content: variant }),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].confidence, 'medium');
});

test('different synopsis prefixes still merge through the shared ending', () => {
  const groups = groupMedia([
    makeVideo({ id: 1, name: '甲剧', source: 'a', year: '2023', content: LONG_SYNOPSIS }),
    makeVideo({ id: 2, name: '乙剧', source: 'b', year: '2023', content: `简介${LONG_SYNOPSIS}` }),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].confidence, 'medium');
});

test('short synopses do not trigger a merge', () => {
  const groups = groupMedia([
    makeVideo({ id: 1, name: '甲剧', source: 'a', year: '2023', content: '少年复仇。' }),
    makeVideo({ id: 2, name: '乙剧', source: 'b', year: '2023', content: '少年复仇。' }),
  ]);

  assert.equal(groups.length, 2);
});

test('identical synopses do not merge across different years', () => {
  const groups = groupMedia([
    makeVideo({ id: 1, name: '甲剧', source: 'a', year: '2019', content: LONG_SYNOPSIS }),
    makeVideo({ id: 2, name: '乙剧', source: 'b', year: '2024', content: LONG_SYNOPSIS }),
  ]);

  assert.equal(groups.length, 2);
});

test('identical synopses do not merge across different seasons', () => {
  const groups = groupMedia([
    makeVideo({ id: 1, name: '同名剧 第一季', source: 'a', year: '2023', content: LONG_SYNOPSIS }),
    makeVideo({ id: 2, name: '同名剧 第二季', source: 'b', year: '2023', content: LONG_SYNOPSIS }),
  ]);

  assert.equal(groups.length, 2);
});

test('a missing-year result joins one known year, never bridging two years', () => {
  const groups = groupMedia([
    makeVideo({ id: 1, name: '甲剧', source: 'a', year: '2019', content: LONG_SYNOPSIS }),
    makeVideo({ id: 2, name: '乙剧', source: 'b', content: LONG_SYNOPSIS }),
    makeVideo({ id: 3, name: '丙剧', source: 'c', year: '2024', content: LONG_SYNOPSIS }),
  ]);

  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups.map((group) => group.year).sort(),
    ['2019', '2024'],
  );
  assert.ok(groups.every((group) => group.candidates.length <= 2));
});

test('boilerplate synopsis shared by too many groups is ignored', () => {
  const videos = Array.from({ length: 13 }, (_, index) =>
    makeVideo({
      id: index + 1,
      name: `剧集${index + 1}`,
      source: `s${index + 1}`,
      year: '2023',
      content: LONG_SYNOPSIS,
    }),
  );

  assert.equal(groupMedia(videos).length, 13);
});

test('people normalization removes labels and role annotations', () => {
  assert.deepEqual(
    normalizePeople('导演：張藝謀 主演：沈騰、馬麗 飾 角色'),
    ['张艺谋', '沈腾', '马丽'],
  );
  assert.deepEqual(normalizePeople('张若昀,李沁,张若昀'), ['张若昀', '李沁']);
  assert.deepEqual(normalizePeople('暂无'), []);
});

test('same director and shared cast merge different titles', () => {
  const groups = groupMedia([
    makeVideo({
      id: 1,
      name: '甲剧',
      source: 'a',
      year: '2023',
      director: '张艺谋',
      actor: '沈腾,马丽',
    }),
    makeVideo({
      id: 2,
      name: '乙剧',
      source: 'b',
      year: '2023',
      director: '张艺谋',
      actor: '沈腾,马丽',
    }),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].confidence, 'medium');
  assert.equal(groups[0].candidates.length, 2);
});

test('same director with disjoint casts does not merge', () => {
  const groups = groupMedia([
    makeVideo({
      id: 1,
      name: '甲剧',
      source: 'a',
      year: '2023',
      director: '张艺谋',
      actor: '沈腾',
    }),
    makeVideo({
      id: 2,
      name: '乙剧',
      source: 'b',
      year: '2023',
      director: '张艺谋',
      actor: '易烊千玺',
    }),
  ]);

  assert.equal(groups.length, 2);
});

test('different directors block a cast-only merge', () => {
  const groups = groupMedia([
    makeVideo({
      id: 1,
      name: '甲剧',
      source: 'a',
      year: '2023',
      director: '张艺谋',
      actor: '沈腾,马丽',
    }),
    makeVideo({
      id: 2,
      name: '乙剧',
      source: 'b',
      year: '2023',
      director: '宁浩',
      actor: '沈腾,马丽',
    }),
  ]);

  assert.equal(groups.length, 2);
});

test('two shared actors merge when directors are missing', () => {
  const groups = groupMedia([
    makeVideo({
      id: 1,
      name: '甲剧',
      source: 'a',
      year: '2023',
      actor: '沈腾,马丽,艾伦',
    }),
    makeVideo({
      id: 2,
      name: '乙剧',
      source: 'b',
      year: '2023',
      actor: '沈腾,马丽,魏翔,常远',
    }),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].confidence, 'medium');
});

test('a single shared actor does not merge when directors are missing', () => {
  const groups = groupMedia([
    makeVideo({ id: 1, name: '甲剧', source: 'a', year: '2023', actor: '沈腾,马丽' }),
    makeVideo({ id: 2, name: '乙剧', source: 'b', year: '2023', actor: '沈腾,艾伦' }),
  ]);

  assert.equal(groups.length, 2);
});

test('people matches never cross different years or seasons', () => {
  const differentYears = groupMedia([
    makeVideo({
      id: 1,
      name: '甲剧',
      source: 'a',
      year: '2019',
      director: '张艺谋',
      actor: '沈腾,马丽',
    }),
    makeVideo({
      id: 2,
      name: '乙剧',
      source: 'b',
      year: '2024',
      director: '张艺谋',
      actor: '沈腾,马丽',
    }),
  ]);
  assert.equal(differentYears.length, 2);

  const differentSeasons = groupMedia([
    makeVideo({
      id: 1,
      name: '甲剧 第一季',
      source: 'a',
      year: '2023',
      director: '张艺谋',
      actor: '沈腾,马丽',
    }),
    makeVideo({
      id: 2,
      name: '乙剧 第二季',
      source: 'b',
      year: '2023',
      director: '张艺谋',
      actor: '沈腾,马丽',
    }),
  ]);
  assert.equal(differentSeasons.length, 2);
});

test('episode counts are extracted from remarks and explicit title markers', () => {
  assert.equal(extractEpisodeCount('全46集'), 46);
  assert.equal(extractEpisodeCount('更新至12集'), 12);
  assert.equal(extractEpisodeCount('1-12集'), 12);
  assert.equal(extractEpisodeCount('共24话'), 24);
  assert.equal(extractEpisodeCount('HD中字'), undefined);
  assert.equal(extractEpisodeCount(undefined, '某剧 全36集'), 36);
  assert.equal(extractEpisodeCount(undefined, '12集'), undefined);
});

test('same episode count and related titles merge', () => {
  const groups = groupMedia([
    makeVideo({ id: 1, name: '庆余年', source: 'a', year: '2019', remarks: '全46集' }),
    makeVideo({ id: 2, name: '庆余年 特别篇', source: 'b', year: '2019', remarks: '全46集' }),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].confidence, 'medium');
  assert.equal(groups[0].candidates.length, 2);
});

test('different episode counts never merge', () => {
  const groups = groupMedia([
    makeVideo({ id: 1, name: '庆余年', source: 'a', year: '2019', remarks: '全46集' }),
    makeVideo({ id: 2, name: '庆余年 特别篇', source: 'b', year: '2019', remarks: '全24集' }),
  ]);

  assert.equal(groups.length, 2);
});

test('same episode count alone does not merge unrelated titles', () => {
  const groups = groupMedia([
    makeVideo({ id: 1, name: '甲剧', source: 'a', year: '2023', remarks: '全12集' }),
    makeVideo({ id: 2, name: '乙剧', source: 'b', year: '2023', remarks: '全12集' }),
  ]);

  assert.equal(groups.length, 2);
});

test('same episode count plus one shared actor merges', () => {
  const groups = groupMedia([
    makeVideo({
      id: 1,
      name: '甲剧',
      source: 'a',
      year: '2023',
      remarks: '全12集',
      actor: '沈腾',
    }),
    makeVideo({
      id: 2,
      name: '乙剧',
      source: 'b',
      year: '2023',
      remarks: '全12集',
      actor: '沈腾',
    }),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].confidence, 'medium');
});

const MODERATE_SYNOPSIS_ONE =
  '在遥远的北方王国里年轻的猎人意外救下受伤的白狼两人结伴穿越冰原寻找传说中的永恒之火';
const MODERATE_SYNOPSIS_TWO =
  '在遥远的北方王国里年轻的猎人意外救下受伤的白狼旅途中他们遭遇背叛并最终揭开了王国的秘密';

test('same episode count plus moderate synopsis similarity merges', () => {
  const groups = groupMedia([
    makeVideo({
      id: 1,
      name: '甲剧',
      source: 'a',
      year: '2023',
      remarks: '全12集',
      content: MODERATE_SYNOPSIS_ONE,
    }),
    makeVideo({
      id: 2,
      name: '乙剧',
      source: 'b',
      year: '2023',
      remarks: '全12集',
      content: MODERATE_SYNOPSIS_TWO,
    }),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].confidence, 'medium');
});
