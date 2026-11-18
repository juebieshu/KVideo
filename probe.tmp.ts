import { groupMedia } from '@/lib/media/group';
import type { Video, MediaGroup } from '@/lib/types';

function mk(o: {
  id: number | string;
  name: string;
  source?: string;
  year?: string;
  content?: string;
  actor?: string;
  director?: string;
  remarks?: string;
}): Video {
  return {
    vod_id: o.id,
    vod_name: o.name,
    source: o.source ?? `s${o.id}`,
    vod_year: o.year,
    vod_content: o.content,
    vod_actor: o.actor,
    vod_director: o.director,
    vod_remarks: o.remarks,
  };
}
function summarize(groups: MediaGroup[]) {
  return groups.map((g) => ({ title: g.title, year: g.year, n: g.candidates.length }));
}

// Q1: a "too popular" actor skipped by pass 3 (>30 groups) is still accepted by pass 4
{
  const videos: Video[] = [];
  for (let i = 1; i <= 35; i += 1) {
    videos.push(
      mk({
        id: i,
        name: `杂剧${String.fromCharCode(0x4e00 + i * 3)}${String.fromCharCode(0x4e00 + i * 7 + 1)}`,
        year: '2023',
        remarks: '全40集',
        actor: '成龙', // 35 groups share one actor -> pass-3 actor bucket is skipped
        director: `导演${String.fromCharCode(0x4e00 + i * 11 + 2)}`,
        content: `独立的剧情介绍文字编号${i}${'甲乙丙丁戊己庚辛壬癸'.repeat(10)}`,
      }),
    );
  }
  console.log('Q1 35 unrelated 40-ep shows sharing one actor:', JSON.stringify(summarize(groupMedia(videos))));
}

// Q2: different seasons written as trailing digits (not parsed as season) merge in pass 4
{
  const groups = groupMedia([
    mk({ id: 101, name: '爱情公寓3', remarks: '全24集', actor: '陈赫', director: '韦正', content: '爱情公寓第三季的独立剧情介绍文字，讲述了几位年轻人的合租生活与友情故事，内容与第四季不同。' }),
    mk({ id: 102, name: '爱情公寓4', remarks: '全24集', actor: '陈赫', director: '汪远', content: '爱情公寓第四季的独立剧情介绍文字，讲述了几位年轻人的合租生活与友情故事，内容与第三季不同。' }),
  ]);
  console.log('Q2 爱情公寓3 vs 爱情公寓4 (no year):', JSON.stringify(summarize(groups)));
}

// Q3: pass 4 merges groups with different known directors on one shared actor
{
  const groups = groupMedia([
    mk({ id: 201, name: '甲剧', year: '2023', remarks: '全12集', actor: '沈腾', director: '张艺谋' }),
    mk({ id: 202, name: '乙剧', year: '2023', remarks: '全12集', actor: '沈腾', director: '宁浩' }),
  ]);
  console.log('Q3 different directors, one shared actor:', JSON.stringify(summarize(groups)));
}

// Q4: order-flip with a season-less wildcard
{
  const a = groupMedia([
    mk({ id: 301, name: '同名剧 第一季', year: '2023', content: '一段足够长的简介文字用于触发第二遍合并测试甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥' }),
    mk({ id: 302, name: '另一个剧', year: '2023', content: '一段足够长的简介文字用于触发第二遍合并测试甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥' }),
    mk({ id: 303, name: '同名剧 第二季', year: '2023', content: '一段足够长的简介文字用于触发第二遍合并测试甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥' }),
  ]);
  const b = groupMedia([
    mk({ id: 303, name: '同名剧 第二季', year: '2023', content: '一段足够长的简介文字用于触发第二遍合并测试甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥' }),
    mk({ id: 302, name: '另一个剧', year: '2023', content: '一段足够长的简介文字用于触发第二遍合并测试甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥' }),
    mk({ id: 301, name: '同名剧 第一季', year: '2023', content: '一段足够长的简介文字用于触发第二遍合并测试甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥' }),
  ]);
  const describe = (groups: MediaGroup[]) =>
    groups.map((g) => `${g.title}[s?]:${g.candidates.map((c) => c.title).join('+')}`);
  console.log('Q4 season-order A:', describe(a));
  console.log('Q4 season-order B:', describe(b));
}

// Q5: same episode count, no actors, title dice exactly 0.5 merges different entries
{
  const groups = groupMedia([
    mk({ id: 401, name: '独立剧3号', year: '2023', remarks: '全40集' }),
    mk({ id: 402, name: '独立剧4号', year: '2023', remarks: '全40集' }),
  ]);
  console.log('Q5 title dice 0.5:', JSON.stringify(summarize(groups)));
}
