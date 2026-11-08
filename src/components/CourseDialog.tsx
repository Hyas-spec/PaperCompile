import { useMemo, useState } from 'react';
import { useCourseStore } from '../courses/store';
import type { CourseTemplate } from '../courses/types';
import { ACTIVE_COURSE } from '../courses/active';
import '../styles/refine.css';

type DialogMode = 'list' | 'create';

interface TypeForm {
  label: string;
  score: number;
  count: number;
}

const DEFAULT_CHAPTERS = ['课程导论|4', '核心概念|8', '方法与分析|8', '综合应用|6'].join('\n');

const DEFAULT_TYPES: TypeForm[] = [
  { label: '单项选择题', score: 2, count: 15 },
  { label: '填空题', score: 2, count: 5 },
  { label: '简答与分析题', score: 5, count: 4 },
  { label: '算法设计与分析题', score: 20, count: 2 },
];

const parseChapters = (text: string): Array<{ title: string; hours: number }> =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => {
      const [title, hours] = line.split(/\s*[|｜\t]\s*/);
      const parsed = Number.parseInt(hours ?? '', 10);
      return {
        title: (title ?? '').trim(),
        hours: Number.isFinite(parsed) && parsed > 0 ? parsed : 4,
      };
    })
    .filter((chapter) => chapter.title.length > 0);

const summaryOf = (template: CourseTemplate): string => {
  const count = template.questionTypes.reduce((sum, type) => sum + type.targetCount, 0);
  const score = template.questionTypes.reduce(
    (sum, type) => sum + type.targetCount * type.score,
    0,
  );
  return `${template.chapters.length} 章 · ${count} 题 · ${score} 分 · ${template.durationMinutes} 分钟`;
};

export default function CourseDialog() {
  const dialogOpen = useCourseStore((state) => state.dialogOpen);
  const courses = useCourseStore((state) => state.courses);
  const activeId = useCourseStore((state) => state.activeId);
  const closeDialog = useCourseStore((state) => state.closeDialog);
  const selectCourse = useCourseStore((state) => state.selectCourse);
  const createCourse = useCourseStore((state) => state.createCourse);
  const removeCourse = useCourseStore((state) => state.removeCourse);

  const [mode, setMode] = useState<DialogMode>('list');
  const [name, setName] = useState('');
  const [examName, setExamName] = useState('期末考试');
  const [description, setDescription] = useState('');
  const [chapterText, setChapterText] = useState(DEFAULT_CHAPTERS);
  const [knowledgeText, setKnowledgeText] = useState('');
  const [outOfScopeText, setOutOfScopeText] = useState('');
  const [types, setTypes] = useState<TypeForm[]>(DEFAULT_TYPES);
  const [duration, setDuration] = useState(120);
  const [coverage, setCoverage] = useState(90);
  const [ratioBand, setRatioBand] = useState(3);
  const [easy, setEasy] = useState(30);
  const [medium, setMedium] = useState(50);
  const [hard, setHard] = useState(20);
  const [error, setError] = useState('');

  const builtin = useMemo(() => courses.filter((course) => course.builtin), [courses]);
  const custom = useMemo(() => courses.filter((course) => !course.builtin), [courses]);
  const chapterPreview = useMemo(() => parseChapters(chapterText), [chapterText]);
  const totalScore = types.reduce((sum, type) => sum + type.score * type.count, 0);
  const totalCount = types.reduce((sum, type) => sum + type.count, 0);

  if (!dialogOpen) return null;

  const updateType = (index: number, patch: Partial<TypeForm>) => {
    setTypes((previous) =>
      previous.map((type, itemIndex) =>
        itemIndex === index ? { ...type, ...patch } : type,
      ),
    );
  };

  const generateKnowledge = () => {
    const lines = chapterPreview.flatMap((chapter) => [
      `${chapter.title} | ${chapter.title}核心概念 | 记忆`,
      `${chapter.title} | ${chapter.title}方法与应用 | 应用`,
    ]);
    setKnowledgeText(lines.join('\n'));
  };

  const submit = () => {
    if (!name.trim()) {
      setError('请填写课程名称。');
      return;
    }
    if (chapterPreview.length < 2) {
      setError('至少填写 2 个章节，每行格式：章节名 | 学时。');
      return;
    }
    const chapterTitles = chapterPreview.map((chapter) => chapter.title);
    if (new Set(chapterTitles).size !== chapterTitles.length) {
      setError('章节名称不能重复。');
      return;
    }
    if (totalCount <= 0) {
      setError('题型题量合计必须大于 0。');
      return;
    }
    if (types.some((type) => !type.label.trim() || type.score <= 0)) {
      setError('每个题型都需要名称与大于 0 的分值。');
      return;
    }
    const typeLabels = types.map((type) => type.label.trim());
    if (new Set(typeLabels).size !== typeLabels.length) {
      setError('题型名称不能重复。');
      return;
    }
    setError('');
    createCourse({
      name: name.trim(),
      examName: examName.trim() || '期末考试',
      description: description.trim(),
      chapters: chapterPreview,
      types,
      knowledgeText,
      outOfScopeText,
      durationMinutes: duration,
      coverageRate: coverage,
      ratioBand,
      easyRatio: easy,
      mediumRatio: medium,
      hardRatio: hard,
    });
  };

  return (
    <div className="course-modal-backdrop" role="presentation">
      <div
        className="course-modal"
        role="dialog"
        aria-modal="true"
        aria-label="课程选择与新建"
      >
        <header className="course-modal-head">
          <div>
            <span className="course-modal-kicker">课程模板</span>
            <h2>{mode === 'list' ? '选择课程' : '新建自定义课程'}</h2>
            <p>
              当前：{ACTIVE_COURSE.name} · {ACTIVE_COURSE.examName}。切换课程会重置本次命题会话
              （纯前端演示，不写数据库）。
            </p>
          </div>
          <button
            type="button"
            className="course-modal-close"
            onClick={() => {
              setMode('list');
              setError('');
              closeDialog();
            }}
            aria-label="关闭"
          >
            ×
          </button>
        </header>

        {mode === 'list' ? (
          <div className="course-modal-body">
            <section className="course-group">
              <div className="course-group-head">
                <h3>内置演示模板</h3>
                <span>《数据结构》保留附录 B 口径，可一键载入</span>
              </div>
              <div className="course-grid">
                {builtin.map((course) => (
                  <article
                    key={course.id}
                    className={`course-card${course.id === activeId ? ' is-active' : ''}`}
                  >
                    <div className="course-card-top">
                      <strong>{course.name}</strong>
                      {course.id === activeId ? (
                        <span className="course-tag is-current">当前课程</span>
                      ) : (
                        <span className="course-tag">内置</span>
                      )}
                    </div>
                    <p>{course.description}</p>
                    <small>{summaryOf(course)}</small>
                    <div className="course-card-actions">
                      <button
                        type="button"
                        className="course-btn is-primary"
                        disabled={course.id === activeId}
                        onClick={() => selectCourse(course.id)}
                      >
                        {course.id === activeId ? '正在使用' : '载入此模板'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="course-group">
              <div className="course-group-head">
                <h3>自定义课程</h3>
                <span>保存在浏览器 localStorage，可随时删除</span>
              </div>
              {custom.length === 0 ? (
                <p className="course-empty">
                  尚未新建自定义课程。可新建操作系统、计算机网络等课程模板，或直接使用内置模板。
                </p>
              ) : (
                <div className="course-grid">
                  {custom.map((course) => (
                    <article
                      key={course.id}
                      className={`course-card${
                        course.id === activeId ? ' is-active' : ''
                      }`}
                    >
                      <div className="course-card-top">
                        <strong>{course.name}</strong>
                        <span className="course-tag">自定义</span>
                      </div>
                      <p>{course.description}</p>
                      <small>{summaryOf(course)}</small>
                      <div className="course-card-actions">
                        <button
                          type="button"
                          className="course-btn is-primary"
                          disabled={course.id === activeId}
                          onClick={() => selectCourse(course.id)}
                        >
                          {course.id === activeId ? '正在使用' : '切换到此课程'}
                        </button>
                        <button
                          type="button"
                          className="course-btn is-danger"
                          onClick={() => {
                            if (window.confirm(`删除自定义课程「${course.name}」？`)) {
                              removeCourse(course.id);
                            }
                          }}
                        >
                          删除
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="course-modal-body course-form">
            <section className="course-form-section">
              <h3>基本信息</h3>
              <div className="course-form-grid">
                <label>
                  <span>课程名称 *</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="例如：操作系统"
                  />
                </label>
                <label>
                  <span>考试名称</span>
                  <input
                    value={examName}
                    onChange={(event) => setExamName(event.target.value)}
                    placeholder="例如：期末考试"
                  />
                </label>
                <label className="is-wide">
                  <span>课程说明</span>
                  <input
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="一句话说明课程定位与演示范围"
                  />
                </label>
              </div>
            </section>

            <section className="course-form-section">
              <div className="course-form-head">
                <h3>章节与学时</h3>
                <span>每行：章节名 | 学时</span>
              </div>
              <textarea
                className="course-textarea"
                value={chapterText}
                onChange={(event) => setChapterText(event.target.value)}
                rows={6}
                placeholder={'第一章 | 4\n第二章 | 8'}
              />
              <p className="course-form-hint">
                已识别 {chapterPreview.length} 章 ·{' '}
                {chapterPreview.reduce((sum, chapter) => sum + chapter.hours, 0)} 学时。
                蓝图题量会按学时权重自动分配到各章，教师仍可在蓝图看板调整。
              </p>
            </section>

            <section className="course-form-section">
              <div className="course-form-head">
                <h3>知识点</h3>
                <button type="button" className="course-btn" onClick={generateKnowledge}>
                  按章节生成知识点
                </button>
              </div>
              <textarea
                className="course-textarea"
                value={knowledgeText}
                onChange={(event) => setKnowledgeText(event.target.value)}
                rows={6}
                placeholder={'章节名 | 知识点 | 认知层次（可选）\n例如：进程管理 | 进程状态转换 | 理解'}
              />
              <p className="course-form-hint">
                留空时为每章自动生成“核心概念 / 方法与应用”两个知识点；认知层次可选记忆、理解、应用、分析、综合。
              </p>
            </section>

            <section className="course-form-section">
              <div className="course-form-head">
                <h3>题型与分值</h3>
                <span>
                  合计 {totalCount} 题 / {totalScore} 分
                </span>
              </div>
              <div className="course-type-table">
                <div className="course-type-row is-head">
                  <span>题型</span>
                  <span>每题分值</span>
                  <span>目标题量</span>
                  <span>小计</span>
                </div>
                {types.map((type, index) => (
                  <div className="course-type-row" key={index}>
                    <input
                      value={type.label}
                      onChange={(event) => updateType(index, { label: event.target.value })}
                      aria-label={`第 ${index + 1} 个题型名称`}
                    />
                    <input
                      type="number"
                      min={1}
                      value={type.score}
                      onChange={(event) =>
                        updateType(index, { score: Number(event.target.value) })
                      }
                      aria-label={`第 ${index + 1} 个题型分值`}
                    />
                    <input
                      type="number"
                      min={0}
                      value={type.count}
                      onChange={(event) =>
                        updateType(index, { count: Number(event.target.value) })
                      }
                      aria-label={`第 ${index + 1} 个题型题量`}
                    />
                    <span>{type.score * type.count} 分</span>
                  </div>
                ))}
              </div>
              <p className="course-form-hint">
                题型角色按顺序固定为单选 / 填空 / 简答 / 综合设计，名称与分值可改；满分按“题量 × 分值”自动汇总。
              </p>
            </section>

            <section className="course-form-section">
              <div className="course-form-head">
                <h3>考核目标</h3>
                <span>难度、覆盖率与配比带宽</span>
              </div>
              <div className="course-form-grid">
                <label>
                  <span>考试时长（分钟）</span>
                  <input
                    type="number"
                    min={30}
                    value={duration}
                    onChange={(event) => setDuration(Number(event.target.value))}
                  />
                </label>
                <label>
                  <span>知识点覆盖率阈值（%）</span>
                  <input
                    type="number"
                    min={50}
                    max={100}
                    value={coverage}
                    onChange={(event) => setCoverage(Number(event.target.value))}
                  />
                </label>
                <label>
                  <span>三维配比带宽（±%）</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={ratioBand}
                    onChange={(event) => setRatioBand(Number(event.target.value))}
                  />
                </label>
                <label>
                  <span>易档占比（%）</span>
                  <input
                    type="number"
                    min={0}
                    value={easy}
                    onChange={(event) => setEasy(Number(event.target.value))}
                  />
                </label>
                <label>
                  <span>中档占比（%）</span>
                  <input
                    type="number"
                    min={0}
                    value={medium}
                    onChange={(event) => setMedium(Number(event.target.value))}
                  />
                </label>
                <label>
                  <span>难档占比（%）</span>
                  <input
                    type="number"
                    min={0}
                    value={hard}
                    onChange={(event) => setHard(Number(event.target.value))}
                  />
                </label>
                <label className="is-wide">
                  <span>超纲禁区（每行：章节名 | 概念，可选）</span>
                  <textarea
                    className="course-textarea"
                    value={outOfScopeText}
                    onChange={(event) => setOutOfScopeText(event.target.value)}
                    rows={3}
                    placeholder={'进程管理 | 实时调度算法\n文件管理 | 分布式文件系统'}
                  />
                </label>
              </div>
            </section>

            {error && <p className="course-form-error">{error}</p>}
          </div>
        )}

        <footer className="course-modal-actions">
          {mode === 'list' ? (
            <>
              <span className="course-modal-footnote">
                切换课程后所有页面重新读取当前课程配置，不混用其他课程数据。
              </span>
              <button
                type="button"
                className="course-btn is-primary"
                onClick={() => {
                  setMode('create');
                  setError('');
                }}
              >
                新建自定义课程
              </button>
            </>
          ) : (
            <>
              <button type="button" className="course-btn" onClick={() => setMode('list')}>
                返回课程列表
              </button>
              <button type="button" className="course-btn is-primary" onClick={submit}>
                创建并载入课程
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
