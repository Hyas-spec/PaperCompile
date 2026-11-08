# Git 提交规范

> 目标：让评委从提交历史里看出“真实演进”，而不是最后一天拼出来的。

## 1. 基本格式

```text
type(scope): 一句话说清做了什么

为什么做（可选，1-3 行）
对应 Prompt：P03
验证：npm run check / 手动步骤
```

### type

| type | 用途 |
|---|---|
| `feat` | 新功能 |
| `fix` | 修 bug |
| `test` | 只加/改测试 |
| `refactor` | 不改变行为的重构 |
| `style` | 样式/格式（不影响逻辑） |
| `docs` | 文档 |
| `chore` | 构建/依赖/配置 |
| `perf` | 性能 |

### scope（示例）

`syllabus` / `blueprint` / `agent` / `review` / `paper` / `snapshot` / `ui` / `ai` / `security`

## 2. 好例子

```text
feat(blueprint): allocate chapter points with largest remainder

- 平均分配导致章节偏差 8 分
- 改为最大余数 + 贪心，偏差 <= 单题最大分值
- 同一 seed 结果稳定

Prompt: P04
Test: npm run test -- allocator
```

```text
fix(ai): recover from truncated JSON with one repair retry

- 模型输出被 max tokens 截断时白屏
- 提取平衡 JSON，Zod 校验，失败发一次修复 Prompt
- 仍失败返回可下载原始输出

Prompt: P05
Test: supertest + npm run check
```

## 3. 不要做的事

- 不要 `git add .` 一把梭；按模块拆。
- 不要最后一天一个 `initial commit`。
- 不要伪造作者/时间。
- 不要提交 `.env`、`node_modules`、`dist`、大录屏。
- 不要为了“好看”改写已经 push 的历史。
- 不要在提交信息里写“update”“fix bug”这种没有信息量的词。

## 4. 提交前检查

```bash
git status
git diff --stat
npm run check
```

- [ ] 只包含本次相关文件。
- [ ] 没有密钥/隐私数据。
- [ ] 测试通过。
- [ ] 提交信息能对应到一个 Prompt/功能。
- [ ] 已 push 到远程（每天至少一次）。

## 5. 每日目标

- Day 1–2：4–6 条/天
- Day 3–5：5–8 条/天
- Day 6–7：3–5 条/天
- 总计：40+ 条有意义的提交

> 数量不是目的。**每条提交都能讲清楚“为什么改”**，才是有效的演进记录。
