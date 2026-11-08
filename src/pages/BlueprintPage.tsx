import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePaperStore } from '../store';
import '../styles/blueprint.css';

const TYPES = [
  { key: 'choice', label: '单项选择题', short: '单选', score: 2, targetCount: 15 },
  { key: 'fill', label: '填空题', short: '填空', score: 2, targetCount: 5 },
  { key: 'short', label: '简答与分析题', short: '简答', score: 5, targetCount: 4 },
  { key: 'algorithm', label: '算法设计与分析题', short: '算法', score: 20, targetCount: 2 },
] as const;

type TypeKey = (typeof TYPES)[number]['key'];

const COGNITIVE_LEVELS = ['记忆', '理解', '应用', '分析', '综合'] as const;

interface ChapterDef {
  id: string;
  no: number;
  title: string;
  hours: number;
  knowledgePoints: number;
  targetScore: number;
  expectedDifficulty: number;
  targetCounts: Record<TypeKey, number>;
  cognitiveMix: number[];
}

/**
 * 章节、学时、知识点、目标分值与期望难度对齐项目说明书表 B-1。
 * 认知层次按章节知识点认知层次估算，用于三维配比中的认知层次视图。
 */
const CHAPTERS: ChapterDef[] = [
  {
    id: 'ch01',
    no: 1,
    title: '绪论',
    hours: 4,
    knowledgePoints: 4,
    targetScore: 6,
    expectedDifficulty: 0.85,
    targetCounts: { choice: 2, fill: 1, short: 0, algorithm: 0 },
    cognitiveMix: [0.4, 0.4, 0.2, 0, 0],
  },
  {
    id: 'ch02',
    no: 2,
    title: '线性表',
    hours: 8,
    knowledgePoints: 7,
    targetScore: 8,
    expectedDifficulty: 0.78,
    targetCounts: { choice: 3, fill: 1, short: 0, algorithm: 0 },
    cognitiveMix: [0.15, 0.45, 0.4, 0, 0],
  },
  {
    id: 'ch03',
    no: 3,
    title: '栈与队列',
    hours: 6,
    knowledgePoints: 5,
    targetScore: 11,
    expectedDifficulty: 0.75,
    targetCounts: { choice: 2, fill: 1, short: 1, algorithm: 0 },
    cognitiveMix: [0.1, 0.4, 0.5, 0, 0],
  },
  {
    id: 'ch04',
    no: 4,
    title: '串',
    hours: 4,
    knowledgePoints: 3,
    targetScore: 7,
    expectedDifficulty: 0.8,
    targetCounts: { choice: 1, fill: 0, short: 1, algorithm: 0 },
    cognitiveMix: [0.1, 0.4, 0.4, 0.1, 0],
  },
  {
    id: 'ch05',
    no: 5,
    title: '树与二叉树',
    hours: 10,
    knowledgePoints: 8,
    targetScore: 28,
    expectedDifficulty: 0.62,
    targetCounts: { choice: 3, fill: 1, short: 0, algorithm: 1 },
    cognitiveMix: [0, 0.3, 0.4, 0.3, 0],
  },
  {
    id: 'ch06',
    no: 6,
    title: '图',
    hours: 10,
    knowledgePoints: 7,
    targetScore: 26,
    expectedDifficulty: 0.6,
    targetCounts: { choice: 2, fill: 1, short: 0, algorithm: 1 },
    cognitiveMix: [0, 0.3, 0.4, 0.3, 0],
  },
  {
    id: 'ch07',
    no: 7,
    title: '查找',
    hours: 6,
    knowledgePoints: 4,
    targetScore: 7,
    expectedDifficulty: 0.72,
    targetCounts: { choice: 1, fill: 0, short: 1, algorithm: 0 },
    cognitiveMix: [0.1, 0.4, 0.3, 0.2, 0],
  },
  {
    id: 'ch08',
    no: 8,
    title: '排序',
    hours: 8,
    knowledgePoints: 4,
    targetScore: 7,
    expectedDifficulty: 0.7,
    targetCounts: { choice: 1, fill: 0, short: 1, algorithm: 0 },
    cognitiveMix: [0, 0.3, 0.4, 0.3, 0],
  },
];

type Matrix = Record<string, Record<TypeKey, number>>;

const cloneMatrix = (source: Matrix): Matrix =>
  Object.fromEntries(
    CHAPTERS.map((chapter) => [chapter.id, { ...source[chapter.id] }]),
  ) as Matrix;

const TARGET_MATRIX: Matrix = Object.fromEntries(
  CHAPTERS.map((chapter) => [chapter.id, { ...chapter.targetCounts }]),
) as Matrix;

const TOTAL_KNOWLEDGE_POINTS = CHAPTERS.reduce(
  (sum, chapter) => sum + chapter.knowledgePoints,
  0,
);
const TOTAL_HOURS = CHAPTERS.reduce((sum, chapter) => sum + chapter.hours, 0);
const TARGET_TOTAL_SCORE = CHAPTERS.reduce(
  (sum, chapter) => sum + chapter.targetScore,
  0,
);
const TARGET_TOTAL_COUNT = TYPES.reduce(
  (sum, type) => sum + type.targetCount,
  0,
);

const DIFFICULTY_TARGET = 0.65;
const DIFFICULTY_BAND = 0.05;
const RATIO_BAND = 3;

const formatDeviation = (value: number): string => {
  if (Math.abs(value) < 0.05) return '0.0%';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
};

const share = (value: number, total: number): number =>
  total > 0 ? (value / total) * 100 : 0;

const MatrixCell = ({
  value,
  onChange,
  onFocus,
  label,
}: {
  value: number;
  onChange: (value: string) => void;
  onFocus: () => void;
  label: string;
}) => (
  <input
    className="blueprint-cell-input"
    type="number"
    min={0}
    max={99}
    step={1}
    value={value}
    aria-label={label}
    onChange={(event) => onChange(event.target.value)}
    onFocus={onFocus}
  />
);

export default function BlueprintPage() {
  const [matrix, setMatrix] = useState<Matrix>(() => cloneMatrix(TARGET_MATRIX));
  const [history, setHistory] = useState<Matrix[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState(CHAPTERS[0].id);

  const chapterScore = (chapterId: string): number =>
    TYPES.reduce(
      (sum, type) => sum + matrix[chapterId][type.key] * type.score,
      0,
    );

  const chapterCount = (chapterId: string): number =>
    TYPES.reduce((sum, type) => sum + matrix[chapterId][type.key], 0);

  const totalScore = CHAPTERS.reduce(
    (sum, chapter) => sum + chapterScore(chapter.id),
    0,
  );

  const typeRows = TYPES.map((type) => {
    const count = CHAPTERS.reduce(
      (sum, chapter) => sum + matrix[chapter.id][type.key],
      0,
    );
    const score = CHAPTERS.reduce(
      (sum, chapter) => sum + matrix[chapter.id][type.key] * type.score,
      0,
    );
    const actualShare = share(score, totalScore);
    const targetScore = type.targetCount * type.score;
    const targetShare = targetScore;
    return {
      ...type,
      count,
      actualScore: score,
      actualShare,
      targetScore,
      targetShare,
      deviation: actualShare - targetShare,
    };
  });

  const chapterRows = CHAPTERS.map((chapter) => {
    const count = chapterCount(chapter.id);
    const score = chapterScore(chapter.id);
    const actualShare = share(score, totalScore);
    const deviation = actualShare - chapter.targetScore;
    return { ...chapter, count, score, actualShare, deviation };
  });

  const targetCognitiveScores = COGNITIVE_LEVELS.map((_, index) =>
    CHAPTERS.reduce(
      (sum, chapter) =>
        sum + chapter.targetScore * chapter.cognitiveMix[index],
      0,
    ),
  );

  const actualCognitiveScores = COGNITIVE_LEVELS.map((_, index) =>
    CHAPTERS.reduce(
      (sum, chapter) => sum + chapterScore(chapter.id) * chapter.cognitiveMix[index],
      0,
    ),
  );

  const cognitiveRows = COGNITIVE_LEVELS.map((level, index) => {
    const targetShare = share(
      targetCognitiveScores[index],
      targetCognitiveScores.reduce((sum, value) => sum + value, 0),
    );
    const actualShare = share(actualCognitiveScores[index], totalScore);
    return {
      level,
      targetShare,
      actualShare,
      deviation: actualShare - targetShare,
    };
  });

  const typeDeviation = Math.max(
    ...typeRows.map((row) => Math.abs(row.deviation)),
  );
  const chapterDeviation = Math.max(
    ...chapterRows.map((row) => Math.abs(row.deviation)),
  );
  const cognitiveDeviation = Math.max(
    ...cognitiveRows.map((row) => Math.abs(row.deviation)),
  );
  const threeDimensionalDeviation = Math.max(
    typeDeviation,
    chapterDeviation,
    cognitiveDeviation,
  );

  const coveredChapters = chapterRows.filter((row) => row.count > 0).length;
  const coveredKnowledgePoints = chapterRows
    .filter((row) => row.count > 0)
    .reduce((sum, row) => sum + row.knowledgePoints, 0);
  const coverage = share(coveredKnowledgePoints, TOTAL_KNOWLEDGE_POINTS);

  const weightedDifficulty =
    totalScore > 0
      ? CHAPTERS.reduce(
          (sum, chapter) =>
            sum + chapterScore(chapter.id) * chapter.expectedDifficulty,
          0,
        ) / totalScore
      : 0;

  const emptyChapters = chapterRows.filter((row) => row.count === 0);
  const scorePass = Math.abs(totalScore - TARGET_TOTAL_SCORE) < 0.01;
  const coveragePass = coverage >= 90 && emptyChapters.length === 0;
  const deviationPass = threeDimensionalDeviation <= RATIO_BAND;
  const displayedDifficulty = Number(weightedDifficulty.toFixed(2));
  const difficultyPass =
    Math.abs(displayedDifficulty - DIFFICULTY_TARGET) <= DIFFICULTY_BAND + 1e-9;
  const allPass = scorePass && coveragePass && deviationPass && difficultyPass;
  const navigate = useNavigate();
  const advanceStageTo = usePaperStore((state) => state.advanceStageTo);

  const goContract = () => {
    if (!allPass) return;
    advanceStageTo('命题契约');
    navigate('/contract');
  };

  const worstType = typeRows.reduce((worst, row) =>
    Math.abs(row.deviation) > Math.abs(worst.deviation) ? row : worst,
  );
  const worstChapter = chapterRows.reduce((worst, row) =>
    Math.abs(row.deviation) > Math.abs(worst.deviation) ? row : worst,
  );
  const worstCognitive = cognitiveRows.reduce((worst, row) =>
    Math.abs(row.deviation) > Math.abs(worst.deviation) ? row : worst,
  );

  const suggestions: Array<{ tone: 'pass' | 'hint' | 'block'; text: string }> = [];

  if (!scorePass) {
    const difference = totalScore - TARGET_TOTAL_SCORE;
    suggestions.push({
      tone: 'block',
      text: `当前总分 ${totalScore} 分，满分 100 分，${
        difference > 0 ? `超出 ${difference}` : `少 ${Math.abs(difference)}`
      } 分；先调整题量使总分回到 100 分。`,
    });
  }

  if (!coveragePass) {
    suggestions.push({
      tone: 'block',
      text:
        coverage < 90
          ? `知识点覆盖率 ${coverage.toFixed(1)}%，低于 90%；${
              emptyChapters.length > 0
                ? `建议在${emptyChapters
                    .map((row) => `「${row.title}」`)
                    .join('、')}补充题目，`
                : ''
            }并确保每章至少命中 1 题。`
          : `知识点覆盖率 ${coverage.toFixed(
              1,
            )}% 已达到 90%，但${emptyChapters
              .map((row) => `「${row.title}」`)
              .join('、')}仍无题目；需确保每章至少命中 1 题。`,
    });
  }

  if (Math.abs(worstType.deviation) > RATIO_BAND) {
    const direction = worstType.deviation > 0 ? '减少' : '增加';
    const countDelta = Math.max(
      1,
      Math.round(
        Math.abs(worstType.actualScore - worstType.targetScore) /
          worstType.score,
      ),
    );
    suggestions.push({
      tone: 'block',
      text: `「${worstType.label}」分值占比 ${worstType.actualShare.toFixed(
        1,
      )}%，目标 ${worstType.targetShare.toFixed(
        1,
      )}%，偏差 ${formatDeviation(worstType.deviation)}；建议${direction}约 ${countDelta} 题，并与其它题型对冲总分。`,
    });
  }

  if (Math.abs(worstChapter.deviation) > RATIO_BAND) {
    suggestions.push({
      tone: 'block',
      text: `「${worstChapter.title}」当前 ${worstChapter.score} 分，目标 ${
        worstChapter.targetScore
      } 分，偏差 ${formatDeviation(
        worstChapter.deviation,
      )}；建议调整该章题量或题型结构，使分值回到 ±3% 带宽内。`,
    });
  }

  if (Math.abs(worstCognitive.deviation) > RATIO_BAND) {
    suggestions.push({
      tone: 'block',
      text: `认知层次「${worstCognitive.level}」占比 ${worstCognitive.actualShare.toFixed(
        1,
      )}%，目标 ${worstCognitive.targetShare.toFixed(
        1,
      )}%，偏差 ${formatDeviation(
        worstCognitive.deviation,
      )}；建议调整章节或题型分值分配。`,
    });
  }

  if (!difficultyPass) {
    suggestions.push({
      tone: 'hint',
      text:
        displayedDifficulty > DIFFICULTY_TARGET + DIFFICULTY_BAND
          ? `整卷期望难度 ${displayedDifficulty.toFixed(
              2,
            )}，高于目标 0.65±0.05，整卷偏易；建议降低高得分率章节的分值。`
          : `整卷期望难度 ${displayedDifficulty.toFixed(
              2,
            )}，低于目标 0.65±0.05，整卷偏难；建议增加基础题或调整章节分值。`,
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      tone: 'pass',
      text: `当前蓝图总分 100 分，覆盖率 ${coverage.toFixed(
        1,
      )}%，三维配比偏差 ${threeDimensionalDeviation.toFixed(
        1,
      )}%，期望难度 ${weightedDifficulty.toFixed(2)}，均在目标内。`,
    });
  }

  suggestions.push({
    tone: 'hint',
    text: `目标结构：单选 ${TYPES[0].targetCount} 题、填空 ${TYPES[1].targetCount} 题、简答 ${TYPES[2].targetCount} 题、算法 ${TYPES[3].targetCount} 题，共 ${TARGET_TOTAL_COUNT} 题 / 100 分。`,
  });

  const updateCell = (chapterId: string, key: TypeKey, raw: string) => {
    const next = Math.max(0, Math.min(99, Number.parseInt(raw, 10) || 0));
    if (matrix[chapterId][key] === next) return;
    setHistory((previous) => [
      ...previous.slice(-19),
      cloneMatrix(matrix),
    ]);
    setMatrix((previous) => ({
      ...previous,
      [chapterId]: { ...previous[chapterId], [key]: next },
    }));
  };

  const undo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setMatrix(previous);
    setHistory(history.slice(0, -1));
  };

  const matrixIsTarget = CHAPTERS.every((chapter) =>
    TYPES.every(
      (type) =>
        matrix[chapter.id][type.key] === TARGET_MATRIX[chapter.id][type.key],
    ),
  );

  const balance = () => {
    if (matrixIsTarget) return;
    setHistory((previous) => [...previous.slice(-19), cloneMatrix(matrix)]);
    setMatrix(cloneMatrix(TARGET_MATRIX));
  };

  return (
    <section className="page blueprint-page">
      <header className="page-header">
        <h1>蓝图看板</h1>
        <p className="page-duty">分配题型、分值与难度</p>
      </header>

      <div className="page-panel blueprint-panel">
        <div className="blueprint-toolbar">
          <div className="blueprint-toolbar-left">
            <span className="blueprint-version">
              命题蓝图 <strong>v1</strong>
            </span>
            <span className="blueprint-meta">
              《数据结构》期中考试 · 满分 100 分 · 120 分钟
            </span>
            <span
              className={`blueprint-score${scorePass ? '' : ' is-block'}`}
            >
              总分 {totalScore} / 100
            </span>
          </div>

          <div className="blueprint-toolbar-actions">
            <button
              type="button"
              className="blueprint-btn is-accent"
              onClick={balance}
              disabled={matrixIsTarget}
            >
              一键均衡
            </button>
            <button
              type="button"
              className="blueprint-btn"
              onClick={undo}
              disabled={history.length === 0}
            >
              回退{history.length > 0 ? ` (${history.length})` : ''}
            </button>
            <button
              type="button"
              className="blueprint-btn is-primary"
              onClick={goContract}
              disabled={!allPass}
              title={allPass ? '蓝图校验通过，进入契约编辑器' : '蓝图校验未通过，先按提示调整'}
            >
              下一步 · 契约编辑器
            </button>
          </div>
        </div>

        <div className="blueprint-kpis">
          <div className={`blueprint-kpi${coveragePass ? ' is-pass' : ' is-block'}`}>
            <div className="blueprint-kpi-head">
              <span>知识点覆盖率</span>
              <span
                className={`blueprint-tag${coveragePass ? ' is-pass' : ' is-block'}`}
              >
                {coveragePass ? '达标' : '超限'}
              </span>
            </div>
            <strong className="blueprint-kpi-value">{coverage.toFixed(1)}%</strong>
            <p>
              {coveredKnowledgePoints}/{TOTAL_KNOWLEDGE_POINTS} 知识点 ·{' '}
              {coveredChapters}/{CHAPTERS.length} 章
            </p>
          </div>

          <div
            className={`blueprint-kpi${deviationPass ? ' is-pass' : ' is-block'}`}
          >
            <div className="blueprint-kpi-head">
              <span>三维配比偏差</span>
              <span
                className={`blueprint-tag${deviationPass ? ' is-pass' : ' is-block'}`}
              >
                {deviationPass ? '达标' : '超限'}
              </span>
            </div>
            <strong className="blueprint-kpi-value">
              {threeDimensionalDeviation.toFixed(1)}%
            </strong>
            <p>带宽 ±3% · 题型 / 章节 / 认知层次</p>
          </div>

          <div
            className={`blueprint-kpi${difficultyPass ? ' is-pass' : ' is-block'}`}
          >
            <div className="blueprint-kpi-head">
              <span>整卷期望难度</span>
              <span
                className={`blueprint-tag${difficultyPass ? ' is-pass' : ' is-block'}`}
              >
                {difficultyPass ? '达标' : '超限'}
              </span>
            </div>
            <strong className="blueprint-kpi-value">
              {weightedDifficulty.toFixed(2)}
            </strong>
            <p>目标 0.65 ± 0.05</p>
          </div>
        </div>

        <div className="blueprint-workspace">
          <aside className="blueprint-tree">
            <div className="blueprint-tree-head">
              <h2>课程章节</h2>
              <span>
                {CHAPTERS.length} 章 · {TOTAL_HOURS} 学时
              </span>
            </div>

            <div className="blueprint-tree-body">
              {chapterRows.map((chapter) => (
                <button
                  key={chapter.id}
                  type="button"
                  className={`blueprint-chapter${
                    selectedChapterId === chapter.id ? ' is-active' : ''
                  }${chapter.count === 0 ? ' is-empty' : ''}`}
                  onClick={() => setSelectedChapterId(chapter.id)}
                >
                  <span className="blueprint-chapter-top">
                    <span className="blueprint-chapter-no">
                      {String(chapter.no).padStart(2, '0')}
                    </span>
                    <span className="blueprint-chapter-title">
                      {chapter.title}
                    </span>
                    <span
                      className={`blueprint-chapter-deviation${
                        Math.abs(chapter.deviation) > RATIO_BAND
                          ? ' is-over'
                          : ''
                      }`}
                    >
                      {formatDeviation(chapter.deviation)}
                    </span>
                  </span>
                  <span className="blueprint-chapter-meta">
                    {chapter.hours} 学时 · {chapter.knowledgePoints} 知识点 ·{' '}
                    {chapter.score}/{chapter.targetScore} 分
                  </span>
                  {chapter.count === 0 && (
                    <span className="blueprint-chapter-flag">无题</span>
                  )}
                </button>
              ))}
            </div>
          </aside>

          <section className="blueprint-matrix">
            <div className="blueprint-matrix-head">
              <div>
                <h2>章节 × 题型矩阵</h2>
                <p>单元格为题数；题型分值固定，实时汇总总分。</p>
              </div>
              <span>目标 {TARGET_TOTAL_COUNT} 题 / 100 分</span>
            </div>

            <div className="blueprint-table-wrap">
              <table className="blueprint-table">
                <thead>
                  <tr>
                    <th>章节</th>
                    {TYPES.map((type) => (
                      <th key={type.key}>
                        <span>{type.short}</span>
                        <small>{type.score}分/题</small>
                      </th>
                    ))}
                    <th>小计</th>
                    <th>偏差</th>
                  </tr>
                </thead>
                <tbody>
                  {chapterRows.map((chapter) => (
                    <tr
                      key={chapter.id}
                      className={
                        selectedChapterId === chapter.id ? 'is-active' : ''
                      }
                    >
                      <td>
                        <span className="blueprint-row-no">
                          {String(chapter.no).padStart(2, '0')}
                        </span>
                        <span className="blueprint-row-title">
                          {chapter.title}
                        </span>
                      </td>
                      {TYPES.map((type) => (
                        <td key={type.key}>
                          <MatrixCell
                            value={matrix[chapter.id][type.key]}
                            label={`${chapter.title} ${type.label} 题数`}
                            onFocus={() => setSelectedChapterId(chapter.id)}
                            onChange={(value) =>
                              updateCell(chapter.id, type.key, value)
                            }
                          />
                        </td>
                      ))}
                      <td className="blueprint-score-cell">
                        {chapter.score} 分
                      </td>
                      <td
                        className={`blueprint-deviation-cell${
                          Math.abs(chapter.deviation) > RATIO_BAND
                            ? ' is-over'
                            : ''
                        }`}
                      >
                        {formatDeviation(chapter.deviation)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th>当前</th>
                    {typeRows.map((type) => (
                      <td key={type.key}>{type.count}</td>
                    ))}
                    <td className={scorePass ? '' : 'is-over'}>
                      {totalScore} 分
                    </td>
                    <td>—</td>
                  </tr>
                  <tr>
                    <th>目标</th>
                    {TYPES.map((type) => (
                      <td key={type.key}>{type.targetCount}</td>
                    ))}
                    <td>{TARGET_TOTAL_SCORE} 分</td>
                    <td>—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <aside className="blueprint-side">
            <div className="blueprint-side-block">
              <div className="blueprint-side-head">
                <h2>三维配比</h2>
                <span>带宽 ±3%</span>
              </div>

              <div className="blueprint-deviation-list">
                <div
                  className={`blueprint-deviation-row${
                    typeDeviation > RATIO_BAND ? ' is-over' : ''
                  }`}
                >
                  <span>题型</span>
                  <strong>{typeDeviation.toFixed(1)}%</strong>
                </div>
                <div
                  className={`blueprint-deviation-row${
                    chapterDeviation > RATIO_BAND ? ' is-over' : ''
                  }`}
                >
                  <span>章节</span>
                  <strong>{chapterDeviation.toFixed(1)}%</strong>
                </div>
                <div
                  className={`blueprint-deviation-row${
                    cognitiveDeviation > RATIO_BAND ? ' is-over' : ''
                  }`}
                >
                  <span>认知层次</span>
                  <strong>{cognitiveDeviation.toFixed(1)}%</strong>
                </div>
              </div>

              <p className="blueprint-side-note">
                认知层次按章节知识点认知层次估算。
              </p>
            </div>

            <div className="blueprint-side-block">
              <div className="blueprint-side-head">
                <h2>难度目标（按分值）</h2>
                <span>100%</span>
              </div>

              <div className="blueprint-difficulty-bars">
                {[
                  { label: '易 ≥0.80', value: 30 },
                  { label: '中 0.60–0.80', value: 50 },
                  { label: '难 <0.60', value: 20 },
                ].map((item, index) => (
                  <div className="blueprint-difficulty-row" key={item.label}>
                    <span className="blueprint-difficulty-label">
                      {item.label}
                    </span>
                    <span className="blueprint-difficulty-track">
                      <span
                        className={`blueprint-difficulty-fill level-${index}`}
                        style={{ width: `${item.value}%` }}
                      />
                    </span>
                    <span className="blueprint-difficulty-value">
                      {item.value}%
                    </span>
                  </div>
                ))}
              </div>

              <div className="blueprint-difficulty-target">
                整卷目标 0.65 ± 0.05
              </div>
            </div>
          </aside>
        </div>

        <section className="blueprint-suggestions">
          <div className="blueprint-suggestions-head">
            <h2>调整建议</h2>
            <span
              className={`blueprint-tag${allPass ? ' is-pass' : ' is-block'}`}
            >
              {allPass ? '当前达标' : '待调整'}
            </span>
          </div>

          <ul className="blueprint-suggestion-list">
            {suggestions.map((suggestion, index) => (
              <li
                className={`blueprint-suggestion is-${suggestion.tone}`}
                key={`${suggestion.tone}-${index}`}
              >
                <span className="blueprint-suggestion-dot" />
                <p>{suggestion.text}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
