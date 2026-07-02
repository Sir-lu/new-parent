## 语言规则（硬性规定）

**所有对话必须使用中文进行。** 包括但不限于：回答问题、解释概念、分析方案、AskUserQuestion 的选项和描述、设计文档、commit message。唯一例外是代码本身（变量名、函数名、注释等如有英文惯例可保留）和外部链接/命令。

---

## gstack (REQUIRED — global install)

**Before doing ANY work, verify gstack is installed:**

```bash
test -d ~/.claude/skills/gstack/bin && echo "GSTACK_OK" || echo "GSTACK_MISSING"
```

If GSTACK_MISSING: STOP. Do not proceed. Tell the user:

> gstack is required for all AI-assisted work in this repo.
> Install it:
> ```bash
> git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
> cd ~/.claude/skills/gstack && ./setup --team
> ```
> Then restart your AI coding tool.

Do not skip skills, ignore gstack errors, or work around missing gstack.

Using gstack skills: After install, skills like /qa, /ship, /review, /investigate,
and /browse are available. Use /browse for all web browsing.
Use ~/.claude/skills/gstack/... for gstack file paths (the global path).

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec

## 微信小程序自动部署（硬性规定）

修改 `wxmini/cloudfunctions/**` 后，**测试通过必须自动部署**，不得等用户提醒。

详细流程见 [.claude/rules/wxmini-auto-deploy.md](.claude/rules/wxmini-auto-deploy.md)。

快速命令（在仓库根目录）：

```powershell
powershell -File wxmini/scripts/test-and-deploy.ps1
```

```bash
bash wxmini/scripts/test-and-deploy.sh
```
