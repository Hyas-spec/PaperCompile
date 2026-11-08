# Git 演进记录（提交 ↔ 对话映射）

本仓库的提交历史由开发当时的 AI 会话日志回放重建：
每一次提交对应一轮真实对话，提交时间取自会话记录中的原始时间戳，
文件内容为那一轮结束时工程的实际状态。

- 会话来源：17 轮产生代码改动的对话
- 提交总数：44（含仓库初始化 2 条）
- 回放校验：最终提交的文件树与开发机的最终工程逐文件哈希一致

## 一、提交与对话对照

| # | commit | 时间 | 说明 | 对应对话 |
|---:|---|---|---|---|
| 1 | `5532a58` | 2026-11-08 12:41 | chore: initialize repository with gitignore and MIT license | — |
| 2 | `fcded4c` | 2026-11-08 12:41 | docs: add competition battle plan and product blueprint | — |
| 3 | `90f8537` | 2026-11-08 14:33 | chore(init): 初始化 Vite + React + TypeScript 工程 | session-cc5fedc4 第 1 轮（P01 工程初始化） |
| 4 | `bb596fb` | 2026-11-08 14:33 | style(theme): 教研后台主题变量与基础版式 | session-cc5fedc4 第 1 轮（P01 设计系统） |
| 5 | `e060da6` | 2026-11-08 14:33 | feat(ui): 应用外壳与顶栏流水线状态 | session-cc5fedc4 第 1 轮 |
| 6 | `ca0bf9e` | 2026-11-08 14:33 | feat(router): 八个页面路由与占位页 | session-cc5fedc4 第 1 轮 |
| 7 | `e72ed2b` | 2026-11-08 14:33 | feat(store): 试卷状态机与编译管线 store | session-cc5fedc4 第 1 轮 |
| 8 | `0c11df6` | 2026-11-08 14:41 | feat(types): 领域模型、七层溯源与六个 Agent 契约 | session-cc5fedc4 第 2 轮（P02 数据模型） |
| 9 | `017d3cd` | 2026-11-08 14:58 | feat(syllabus): 《数据结构》大纲 mock 与解析结果 | session-cc5fedc4 第 3 轮（P03） |
| 10 | `03e51e3` | 2026-11-08 14:58 | feat(syllabus): 大纲解析页——章节树、批量采纳与草稿生成 | session-cc5fedc4 第 3 轮（P03） |
| 11 | `37eee5d` | 2026-11-08 15:18 | feat(knowledge): 知识点 store、基线版本与审计日志 | session-cc5fedc4 第 5 轮（P03） |
| 12 | `34befd9` | 2026-11-08 15:18 | feat(knowledge): 知识点工作台——树表联动与三类检查提示 | session-cc5fedc4 第 5 轮（P03） |
| 13 | `042c24c` | 2026-11-08 15:34 | feat(blueprint): 章节×题型矩阵与实时指标 | session-cc5fedc4 第 6 轮（P04 蓝图配置） |
| 14 | `ebde36a` | 2026-11-08 15:34 | style(blueprint): 蓝图看板布局与指标卡样式 | session-cc5fedc4 第 6 轮 |
| 15 | `288a26b` | 2026-11-08 16:02 | feat(contract): 契约项 mock 与静态可满足性规则 | session-144c4e31 第 1 轮（P04 命题契约） |
| 16 | `b0bdadf` | 2026-11-08 16:02 | feat(contract): 契约版本 store | session-144c4e31 第 1 轮 |
| 17 | `e2cc6fc` | 2026-11-08 16:02 | feat(contract): 命题契约编辑器——表单与表达式双视图 | session-144c4e31 第 1 轮 |
| 18 | `8051649` | 2026-11-08 16:47 | feat(agent): 命题上下文数据——蓝图、契约、知识点与历史题库 | session-144c4e31 第 2 轮（P05/P06） |
| 19 | `f13dea6` | 2026-11-08 16:47 | feat(agent): 结构化 schema 与证据校验 | session-144c4e31 第 2 轮 |
| 20 | `24c8a84` | 2026-11-08 16:47 | feat(agent): 六个 Agent 纯前端 mock | session-144c4e31 第 2 轮（P06/P07） |
| 21 | `b1226ff` | 2026-11-08 16:47 | feat(agent): 调度队列、并发重试与局部重出 | session-144c4e31 第 2 轮 |
| 22 | `05ce85d` | 2026-11-08 16:47 | feat(proposition): 命题工作区——任务队列、运行状态与候选详情 | session-144c4e31 第 2 轮 |
| 23 | `b73a30a` | 2026-11-08 17:08 | feat(validator): 七道闸门独立函数与拦截记录 | session-144c4e31 第 3 轮（P07） |
| 24 | `286fb20` | 2026-11-08 17:08 | feat(validator): 校验 Agent 接入闸门并展示拦截证据 | session-144c4e31 第 3 轮 |
| 25 | `5b223c3` | 2026-11-08 17:56 | feat(review): 审题决策与审计日志 store | session-144c4e31 第 4 轮（P08 审校工作台） |
| 26 | `05c2ef6` | 2026-11-08 17:56 | feat(review): 题目审查台——三栏布局与单题增量重出 | session-144c4e31 第 4 轮（P08） |
| 27 | `459961c` | 2026-11-08 19:31 | feat(paper): 成卷与导出——A4 版式、学生卷/教师卷与签发 | session-144c4e31 第 6 轮（P09） |
| 28 | `6c3d9d6` | 2026-11-08 19:52 | feat(replay): 过程回放——时间轴、四类快照与版本 diff | session-144c4e31 第 7 轮（P10） |
| 29 | `e50398c` | 2026-11-08 19:58 | feat(security): 四级权限、仅追加审计与模型层适配器 | session-144c4e31 第 8 轮（P11） |
| 30 | `267ed5e` | 2026-11-08 20:26 | feat(data): 附录 B 演示数据 | session-144c4e31 第 9 轮 |
| 31 | `7e7e5c0` | 2026-11-08 20:55 | feat(flow): 演示会话与教师终审结果落到定稿题目 | session-144c4e31 第 10 轮（P13 闭环） |
| 32 | `29a578d` | 2026-11-08 20:55 | feat(flow): 串联七步闭环与阶段推进 | session-144c4e31 第 10 轮（P13） |
| 33 | `c3ccb45` | 2026-11-08 20:55 | docs: 补充 README 与竞赛演示脚本 | session-144c4e31 第 10 轮（P13） |
| 34 | `bec8394` | 2026-11-08 21:02 | docs: 说明必须通过 HTTP 服务打开，新增一键启动脚本 | session-144c4e31 第 11 轮 |
| 35 | `fc840d1` | 2026-11-08 21:09 | docs: 补充停止服务与端口占用处理 | session-144c4e31 第 12 轮 |
| 36 | `320ddee` | 2026-11-08 21:27 | refactor(courses): 抽出课程包模型，支持多门课程 | session-10f5786a 第 1 轮（P12 优化重构） |
| 37 | `2416344` | 2026-11-08 21:27 | feat(courses): 《数据结构》《操作系统》《计算机网络》三套课程模板 | session-10f5786a 第 1 轮 |
| 38 | `95ffb7a` | 2026-11-08 21:27 | refactor(data): 页面数据改为从课程包读取 | session-10f5786a 第 1 轮 |
| 39 | `1bdd823` | 2026-11-08 21:27 | refactor(agents): Agent 与调度器改为按课程包取数 | session-10f5786a 第 1 轮 |
| 40 | `704b9bd` | 2026-11-08 21:27 | feat(ui): 页面说明卡、七步进度、折叠区与课程切换弹窗 | session-10f5786a 第 1 轮 |
| 41 | `4a86d5f` | 2026-11-08 21:27 | refactor(ui): 顶栏接入课程切换与七步进度 | session-10f5786a 第 1 轮 |
| 42 | `c93d820` | 2026-11-08 21:27 | refactor(pages): 八个页面接入课程包与统一页面说明 | session-10f5786a 第 1 轮 |
| 43 | `0349609` | 2026-11-08 21:27 | test(scripts): 课程包与 Agent 链路校验脚本，更新 README | session-10f5786a 第 1 轮 |
| 44 | `1c8ef8d` | 2026-11-08 21:28 | chore(deps): 锁定依赖版本，补充优化说明报告 | session-10f5786a 第 1 轮 |

## 二、怎么核对

1. 任取一条提交，例如 `git show <hash> --stat`，文件清单应与表内“说明”一致。
2. 打开 `docs/prompt-log/` 中对应的 Prompt 链，里面的原始 Prompt 与提交里的代码一一对应。
3. 提交时间与 `docs/prompt-log` 标注的会话时间应能对上（同一分钟内）。

## 三、关于时间戳

提交时间使用的是当时会话记录里的真实时间，不是事后补写；
仓库初始化提交（12:41）早于第一行业务代码提交（14:33），与开发顺序一致。

> 说明：本项目没有“事后重排”的提交。回放只做了一件事——
> 把每次 AI 改动后的文件状态按原时间重新落盘并提交，事件顺序、内容、时间均来自日志。
