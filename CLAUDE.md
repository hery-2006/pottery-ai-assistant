# 陶艺拉坯 AI智能学习系统 — CLAUDE.md

## 项目概述

基于《中国陶瓷艺术赏析与创作基础》课程构建的陶艺拉坯AI学习平台，包含AI智能问答、分步教学指导、教师数据监测三大模块。

- **技术栈**: Node.js 原生 HTTP 服务器 + 原生 HTML/CSS/JS 前端（无框架）
- **服务器端口**: 3456
- **AI 后端**: DeepSeek (文字问答) + 小米 MIMO (视觉识别)
- **启动方式**: `node server.js` 或双击 `start_server.bat`

---

## 项目文件结构

### 核心文件
| 文件 | 用途 |
|------|------|
| `server.js` | HTTP 服务器，处理 API + 静态文件 + 代理 AI 请求 |
| `index.html` | **陶艺学生**主界面：10步知识库 + AI智能问答 |
| `guide.html` | **AI分步指导**：面对面教学模式，摄像头+语音+步骤导航 |
| `login.html` | 统一登录页：学生/教师/爱好者三种角色 |
| `teacher.html` | **教师面板**：查看学生提问数据、热门问题、AI教学建议 |
| `explore.html` | 陶瓷知识探索页：五大名窑、文化知识 |
| `.env` | API 密钥配置 |
| `start_server.bat` | Windows 启动脚本，崩溃自动重启 |

### 数据文件
| 文件/目录 | 用途 |
|-----------|------|
| `data/users.json` | 所有用户数据（学生、教师、爱好者） |
| `data/teacher_logs/{教师ID}.json` | 按教师分文件的提问日志 |
| `data/chat_history/{用户ID}.json` | 用户 AI 对话历史 |

---

## API 配置 (.env)

```
DEEPSEEK_KEY=sk-xxxxx
DEEPSEEK_URL=api.deepseek.com
DEEPSEEK_PATH=/chat/completions
DEEPSEEK_MODEL=deepseek-chat

VISION_API_KEY=sk-xxxxx
VISION_API_URL=https://api.xiaomimimo.com/v1/chat/completions
VISION_MODEL=mimo-v2-omni

PORT=3456
```

> ⚠️ 实际 API Key 在 `.env` 文件中，请勿提交到 Git。

---

## 教师-学生数据流

```
学生登录 → 填「教师工号」(如T001) → 提问 → /api/teacher/log → data/teacher_logs/T001.json
教师登录 → 工号 T001 → /api/teacher/stats?teacherId=T001 → 只读 T001.json
```

**关键机制**：
- 学生在 `index.html` 提问时，`logTeacherQuery()` 读取 `localStorage.pottery_user.teacherId`，发送给 `/api/teacher/log`
- 服务器按 `teacherId` 分文件存储：`data/teacher_logs/{teacherId}.json`
- 教师面板通过 `teacherId` 参数过滤，只显示自己的学生
- `teacher.html` 有登录保护：非教师角色自动重定向到登录页

---

## 已修复的问题（按时间顺序）

### 2026-06-16（第1天）

**Bug 1: `attachedImage is not defined`**
- 文件: `index.html`
- 原因: `var attachedImage` 声明在 `init()` 函数内部（局部作用域），`sendMessage()` 访问不到
- 修复: 移至全局作用域（与 `chatHistory`、`activeStep` 并列，约第1164行）

**Bug 2: AI分析拉取全量数据（数据泄漏）**
- 文件: `teacher.html` L387
- 原因: `generateAISuggestion()` 调用 `fetch('/api/teacher/stats')` 不带 teacherId
- 修复: 加上 `?teacherId=` 参数

**Bug 3: 学生日志硬编码默认值 T001**
- 文件: `index.html` `logTeacherQuery()` 函数
- 原因: `teacherId: u.teacherId || 'T001'` 硬编码默认值
- 修复: 改为 `teacherId: u.teacherId || ''`

**Bug 4: 服务端日志接口默认值 T001**
- 文件: `server.js` `/api/teacher/log` 端点
- 原因: `var teacherId = payload.teacherId || 'T001'`
- 修复: 拒绝无 teacherId 的请求，返回 400 错误

### 2026-06-17（第2天）

**Bug 5: 教师界面空白 / 数据不显示**
- 根因1: 教师页面无登录保护，未登录时 `currentUser` 为 null
- 根因2: 多个教师账号（33、00、11、2等）没有学生关联，所以数据为0
- 根因3: 实际有数据的教师只有 T001（67条）和 001（7条）
- 修复:
  - 添加登录保护：非教师角色重定向到登录页
  - 头部显示教师名和工号：`👨‍🏫 张老师（T001）`
  - 空数据面板显示教师工号 + 指导文字
  - 改进 `showEmpty()` 错误信息

**Bug 6: API 掉线 / DeepSeek 认证失败**
- 原因: `.env` 被改为火山引擎 Ark Key（`ark-2e3c...`），该 Key 已失效
- 修复: 恢复为标准 DeepSeek API（`sk-d26c...` + `api.deepseek.com`）
- Vision 模型名也从错误的 `xiaomi-mimo-vision` 恢复为 `mimo-v2-omni`

**Feature: AI指导链接添加到学生界面**
- 文件: `index.html` 顶部导航
- 在「首页」按钮后添加了「AI指导」链接，跳转到 `guide.html`

**Feature: 视频替换为B站/抖音搜索**
- 文件: `guide.html`
- 原因: 避免嵌入他人视频的版权问题
- 替换内容:
  - 步骤卡片中的 `<video>` → B站/抖音搜索按钮
  - AI面对面指导的参考视频 → B站/抖音快捷入口
  - `seekStepVideo` → 自动打开B站搜索
  - `updateAITutor` / `openAITutor` → 更新链接而非视频src
- 搜索关键词自动拼接：`陶艺拉坯 {步骤名} 教学`
- 10个步骤全覆盖：揉泥→定中心→开孔→拉高→造型→修坯→干燥→素烧→上釉→釉烧

**额外修复: 删除重复的语音代码块**
- 文件: `guide.html`（原有bug，非我们引入）
- 修复: 删除了 `S.recognition = rec` 的重复代码块

---

## 已知注意事项

1. **服务器稳定性**：后台 bash 任务结束时可能 kill 掉 node 进程。在 Windows 上双击 `start_server.bat` 使用。
2. **教师账号**：有数据的只有 T001（张老师）和 001（李老师），其余教师账号无学生。
3. **学生-教师关联**：学生必须在登录时填写正确的教师工号，数据才能关联。
4. **B站/抖音链接**：在服务器端测试正常，用户本地需能访问 B站/抖音。
5. **浏览器缓存**：修改 `teacher.html` 后需刷新或重启浏览器才会加载新代码。

---

## 常用命令

```bash
# 启动服务器（Windows推荐）
双击 start_server.bat

# 或命令行
node server.js

# 检查服务器状态
curl http://localhost:3456/api/config

# 查看教师T001的数据
curl "http://localhost:3456/api/teacher/stats?teacherId=T001"

# 测试AI接口
curl -X POST "http://localhost:3456/api/chat" -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"什么是陶瓷拉坯"}],"max_tokens":50}'
```

---

## 用户角色与页面映射

| 角色 | 登录后跳转 | 说明 |
|------|-----------|------|
| 陶艺学生 | `index.html` | 10步知识库 + AI问答 |
| 指导老师 | `teacher.html` | 教学数据面板 |
| 爱好者 | `explore.html` | 陶瓷文化探索 |

学生登录需填：学号 + 姓名 + **教师工号**（必填，用于数据关联）
