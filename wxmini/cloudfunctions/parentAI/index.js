const cloud = require("wx-server-sdk");
const https = require("https");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const { buildPrompt } = require("./prompt.js");

// DeepSeek API 配置
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_API_HOST = "api.deepseek.com";
const DEEPSEEK_API_PATH = "/v1/chat/completions";

// 高风险关键词拦截
const CRISIS_KEYWORDS = [
  "自杀", "自残", "自伤", "不想活", "死了算了",
  "虐待", "家暴", "打孩子往死里", "严重抑郁"
];

function detectCrisis(text) {
  return CRISIS_KEYWORDS.some(kw => text.includes(kw));
}

// 判断是否为「数据库集合不存在」错误（首次使用云环境时集合尚未创建）
function isCollectionNotExistError(err) {
  if (!err) return false;
  const msg = String(err.message || err.errMsg || err.msg || "");
  const code = err.errCode ?? err.code;
  return code === -502005 || /collection not exist/i.test(msg) || /ResourceNotFound/i.test(msg) || /Db or Table not exist/i.test(msg);
}

const REQUIRED_COLLECTIONS = ["children", "questions", "feedback", "users"];

// 校验微信 openid（未登录时拒绝写入/读取用户数据）
function requireOpenId(openid) {
  if (!openid) {
    return { success: false, error: "请先登录", needLogin: true };
  }
  return null;
}

// 确保集合存在（已存在则忽略）
async function ensureCollection(collectionName) {
  try {
    await db.createCollection(collectionName);
  } catch (err) {
    const msg = String(err.message || err.errMsg || "");
    if (/already exist|ResourceExist|Table exist|已存在|exist/i.test(msg)) return;
    try {
      await db.collection(collectionName).limit(1).get();
    } catch (getErr) {
      if (isCollectionNotExistError(getErr)) throw err;
    }
  }
}

// 写入集合，若集合不存在则自动创建后重试一次
async function addWithAutoCreate(collectionName, doc) {
  try {
    return await db.collection(collectionName).add({ data: doc });
  } catch (err) {
    if (isCollectionNotExistError(err)) {
      await ensureCollection(collectionName);
      return await db.collection(collectionName).add({ data: doc });
    }
    throw err;
  }
}

/**
 * 递归遍历并清除对象所有字符串字段中的 emoji 和特殊 Unicode 字符
 * 微信小程序文字渲染引擎对 emoji、特殊符号（⏸�）等显示为乱码
 */
function stripEmoji(obj) {
  if (typeof obj === "string") {
    return obj.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}\u{231A}-\u{23FF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E000}-\u{F8FF}]/gu, "")
              .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{20D0}-\u{20FF}]/gu, "")
              .replace(/�/g, "");   // Unicode 替换字符 U+FFFD
  }
  if (Array.isArray(obj)) return obj.map(stripEmoji);
  if (obj && typeof obj === "object") {
    const cleaned = {};
    for (const key of Object.keys(obj)) cleaned[key] = stripEmoji(obj[key]);
    return cleaned;
  }
  return obj;
}

function callDeepSeek(systemPrompt, userMessage) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: "deepseek-chat",     // DeepSeek V3/V4 标准模型
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const req = https.request({
      hostname: DEEPSEEK_API_HOST,
      path: DEEPSEEK_API_PATH,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Length": Buffer.byteLength(postData)
      },
      timeout: 15000       // 内部超时 15s，留余量给云函数 60s 上限
    }, (res) => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => {
        try {
          const result = JSON.parse(body);
          if (result.choices && result.choices[0]) {
            const content = result.choices[0].message.content;
            resolve(JSON.parse(content));
          } else if (result.error) {
            reject(new Error("DeepSeek API 错误: " + result.error.message));
          } else {
            reject(new Error("DeepSeek 返回格式异常: " + body.slice(0, 200)));
          }
        } catch (e) {
          reject(new Error("解析 DeepSeek 响应失败: " + e.message));
        }
      });
    });

    // 连接超时单独处理
    req.on("socket", (socket) => {
      socket.setTimeout(10000);
      socket.on("timeout", () => { req.destroy(); reject(new Error("连接 DeepSeek 超时")); });
    });
    req.on("error", (e) => reject(new Error("DeepSeek 网络错误: " + e.message)));
    req.on("timeout", () => { req.destroy(); reject(new Error("DeepSeek API 响应超时")); });
    req.write(postData);
    req.end();
  });
}

const LLM_MAX_RETRIES = 3;
const LLM_RETRY_DELAY_MS = 1000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callDeepSeekWithRetry(systemPrompt, userMessage) {
  let lastErr;
  for (let attempt = 1; attempt <= LLM_MAX_RETRIES; attempt++) {
    try {
      return await callDeepSeek(systemPrompt, userMessage);
    } catch (err) {
      lastErr = err;
      console.error(`LLM 调用失败 (${attempt}/${LLM_MAX_RETRIES}):`, err.message);
      if (attempt < LLM_MAX_RETRIES) {
        await sleep(LLM_RETRY_DELAY_MS);
      }
    }
  }
  throw lastErr;
}

function fallbackResponse(scene) {
  return {
    rootCause: "（AI 暂时不可用）从你的描述来看，这符合家庭教育中常见的行为模式。",
    emotionalCheck: "我听到了你的困扰。面对孩子的时候，有情绪是正常的——你不是一个人。",
    steps: [
      { step: 1, action: "先暂停一下，深呼吸三次。确保自己不是在情绪爆发状态下跟孩子沟通。", principle: "建设性解决问题（启发式5）" },
      { step: 2, action: "等双方都冷静下来后，用「情感反映」的方式开启对话——先说出孩子的感受，再说你的想法。", principle: "情感反映先行（启发式1）" },
      { step: 3, action: "和孩子一起商量解决方案——给他两个你都能接受的选择，让他来决定。", principle: "给孩子选择权（启发式4）" }
    ],
    keyInsight: "在情绪上脑的时候，最好的教育是暂停——不是不管，是先管好自己的情绪再管孩子。",
    script: "（AI 恢复后会自动生成适合你场景的沟通话术）",
    methodTags: ["情感反映先行", "建设性解决问题", "给孩子选择权"],
    isFallback: true
  };
}

// ═══════════════════════════════════════════════════════
// 云函数入口
// ═══════════════════════════════════════════════════════
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { type } = event;

  switch (type) {

    // ── 检查登录状态（判断是否首次登录）──────────
    case "checkUser": {
      const authErr = requireOpenId(openid);
      if (authErr) return authErr;

      try {
        await ensureCollection("users");
        const { data } = await db.collection("users").where({ openid }).limit(1).get();
        const now = db.serverDate();

        if (data.length === 0) {
          return { success: true, needProfileSetup: true, isNewUser: true };
        }

        const user = data[0];
        const nickName = (user.nickName || "").trim();
        const avatarUrl = (user.avatarUrl || "").trim();
        const needProfileSetup = !nickName || !avatarUrl;

        if (needProfileSetup) {
          return {
            success: true,
            needProfileSetup: true,
            isNewUser: false,
            userId: user._id,
            partialProfile: { nickName, avatarUrl }
          };
        }

        await db.collection("users").doc(user._id).update({
          data: { lastLoginAt: now }
        });

        return {
          success: true,
          needProfileSetup: false,
          isNewUser: false,
          data: {
            openid,
            userId: user._id,
            nickName: user.nickName,
            avatarUrl: user.avatarUrl
          }
        };
      } catch (err) {
        return { success: false, error: err.message || err.errMsg };
      }
    }

    // ── 微信登录（保存/更新昵称头像）──────────────
    case "login": {
      const authErr = requireOpenId(openid);
      if (authErr) return authErr;

      const { nickName, avatarFileID } = event;
      if (!nickName || !avatarFileID) {
        return { success: false, error: "请完善昵称和头像" };
      }

      try {
        await ensureCollection("users");
        const { data } = await db.collection("users").where({ openid }).limit(1).get();
        const now = db.serverDate();
        const profileFields = { nickName, avatarUrl: avatarFileID };

        if (data.length === 0) {
          const result = await db.collection("users").add({
            data: { openid, createdAt: now, lastLoginAt: now, ...profileFields }
          });
          return {
            success: true,
            data: { openid, userId: result._id, ...profileFields }
          };
        }

        const existing = data[0];
        await db.collection("users").doc(existing._id).update({
          data: { lastLoginAt: now, ...profileFields }
        });

        return {
          success: true,
          data: {
            openid,
            userId: existing._id,
            ...profileFields
          }
        };
      } catch (err) {
        return { success: false, error: err.message || err.errMsg };
      }
    }

    // ── AI 问答 ──────────────────────────────────
    case "askAI": {
      const authErr = requireOpenId(openid);
      if (authErr) return authErr;
      const { scene, category, userInput, childContext } = event;
      if (!scene || !userInput) {
        return { success: false, error: "缺少 scene 或 userInput 参数" };
      }

      if (detectCrisis(userInput)) {
        return {
          success: true,
          data: {
            rootCause: "",
            emotionalCheck: "你描述的情况可能需要专业支持。",
            steps: [{ step: 1, action: "建议咨询儿童心理医生或拨打 12355 青少年服务热线。", principle: "专业支持" }],
            keyInsight: "有些问题超出了家庭教育的范畴，寻求专业帮助是对孩子和自己负责的表现。",
            script: "", methodTags: ["专业支持"],
            disclaimer: "本建议不替代专业心理咨询。如果你或孩子处于危险中，请立即寻求帮助。",
            isCrisis: true
          }
        };
      }

      // 构建 prompt（含孩子档案上下文）
      const { system, user } = buildPrompt(scene, category, userInput, childContext || "");

      let aiResult;
      try {
        aiResult = await callDeepSeekWithRetry(system, user);
        aiResult = stripEmoji(aiResult);
      } catch (err) {
        console.error("LLM 重试耗尽，使用兜底回复:", err.message);
        aiResult = fallbackResponse(scene);
      }

      // 写入数据库
      try {
        const doc = {
          openid,
          scene,
          category: category || "",
          question: (userInput || "").slice(0, 500),
          answer: aiResult,
          childContext: (childContext || "").slice(0, 300),
          rating: 0,
          createdAt: db.serverDate(),
        };
        const result = await addWithAutoCreate("questions", doc);
        aiResult._id = result._id;
      } catch (dbErr) {
        console.error("数据库写入失败:", dbErr.message);
      }

      aiResult.disclaimer = "本建议基于帆书新父母教育方法论，仅供参考，不替代专业心理咨询。每个孩子都是独特的生命体，请结合实际情况判断。";
      return { success: true, data: aiResult };
    }

    // ── 评分 ────────────────────────────────────
    case "rateAnswer": {
      const authErr = requireOpenId(openid);
      if (authErr) return authErr;
      const { questionId, rating } = event;
      if (!questionId || rating === undefined) {
        return { success: false, error: "缺少 questionId 或 rating 参数" };
      }
      try {
        await db.collection("questions").doc(questionId).update({
          data: { rating, ratedAt: db.serverDate() }
        });
        await addWithAutoCreate("feedback", { openid, questionId, rating, createdAt: db.serverDate() });
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    // ── 历史 ────────────────────────────────────
    case "getHistory": {
      const authErr = requireOpenId(openid);
      if (authErr) return authErr;
      try {
        const { data } = await db.collection("questions")
          .where({ openid }).orderBy("createdAt", "desc").limit(20).get();
        return { success: true, data };
      } catch (err) {
        return { success: false, error: err.message, data: [] };
      }
    }

    case "getAnswer": {
      const authErr = requireOpenId(openid);
      if (authErr) return authErr;
      const { questionId } = event;
      if (!questionId) return { success: false, error: "缺少 questionId" };
      try {
        const res = await db.collection("questions").doc(questionId).get();
        const doc = res.data;
        if (!doc || doc.openid !== openid) {
          return { success: false, error: "记录不存在或无权访问" };
        }
        return { success: true, data: doc };
      } catch (err) {
        return { success: false, error: err.message || err.errMsg };
      }
    }

    // ── 孩子档案 CRUD ──────────────────────────
    case "addChild": {
      const authErr = requireOpenId(openid);
      if (authErr) return authErr;
      const { name, birthYear, gender, grade, personality, birthOrder, notes } = event;
      if (!name || !birthYear || !gender) {
        return { success: false, error: "缺少必填字段：name/birthYear/gender" };
      }
      try {
        const doc = {
          openid,
          name, birthYear, gender,
          grade: grade || "",
          personality: personality || [],
          birthOrder: birthOrder || "",
          notes: notes || "",
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        };
        const result = await addWithAutoCreate("children", doc);
        return { success: true, childId: result._id };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    case "updateChild": {
      const authErr = requireOpenId(openid);
      if (authErr) return authErr;
      const { childId, name, birthYear, gender, grade, personality, birthOrder, notes } = event;
      if (!childId) return { success: false, error: "缺少 childId" };
      try {
        await db.collection("children").doc(childId).update({
          data: {
            name, birthYear, gender,
            grade: grade || "",
            personality: personality || [],
            birthOrder: birthOrder || "",
            notes: notes || "",
            updatedAt: db.serverDate()
          }
        });
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    case "deleteChild": {
      const authErr = requireOpenId(openid);
      if (authErr) return authErr;
      const { childId } = event;
      if (!childId) return { success: false, error: "缺少 childId" };
      try {
        await db.collection("children").doc(childId).remove();
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    case "listChildren": {
      const authErr = requireOpenId(openid);
      if (authErr) return authErr;
      try {
        const { data } = await db.collection("children")
          .where({ openid }).orderBy("createdAt", "asc").get();
        return { success: true, data };
      } catch (err) {
        if (isCollectionNotExistError(err)) {
          await ensureCollection("children");
          return { success: true, data: [] };
        }
        return { success: false, error: err.message || err.errMsg, data: [] };
      }
    }

    case "getChild": {
      const authErr = requireOpenId(openid);
      if (authErr) return authErr;
      const { childId } = event;
      if (!childId) return { success: false, error: "缺少 childId" };
      try {
        const res = await db.collection("children").doc(childId).get();
        const child = res.data;
        if (!child || !child._id) {
          return { success: false, error: "档案不存在" };
        }
        if (child.openid !== openid) {
          return { success: false, error: "无权访问该档案" };
        }
        return { success: true, data: child };
      } catch (err) {
        return { success: false, error: err.message || err.errMsg };
      }
    }

    // ── 连通性测试 ──────────────────────────────
    case "testConnection": {
      // 不调用 LLM，只测网络和 API Key
      return new Promise((resolve) => {
        const postData = JSON.stringify({
          model: "deepseek-chat",     // DeepSeek V3/V4 标准模型
          messages: [{ role: "user", content: "回复OK" }],
          max_tokens: 5
        });
        const req = https.request({
          hostname: DEEPSEEK_API_HOST,
          path: DEEPSEEK_API_PATH,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
            "Content-Length": Buffer.byteLength(postData)
          },
          timeout: 10000
        }, (res) => {
          let body = "";
          res.on("data", chunk => body += chunk);
          res.on("end", () => {
            try {
              const r = JSON.parse(body);
              resolve({ success: true, message: "DeepSeek 连接正常", status: res.statusCode, model: r.model || "deepseek-chat" });
            } catch (e) {
              resolve({ success: false, error: "响应解析失败", raw: body.slice(0, 200), status: res.statusCode });
            }
          });
        });
        req.on("socket", (s) => s.setTimeout(8000));
        req.on("error", (e) => resolve({ success: false, error: "网络连接失败: " + e.message }));
        req.on("timeout", () => { req.destroy(); resolve({ success: false, error: "连接超时（10s）" }); });
        req.write(postData);
        req.end();
      });
    }

    // ── 初始化数据库集合 ────────────────────────
    case "initDatabase": {
      const results = [];
      for (const name of REQUIRED_COLLECTIONS) {
        try {
          await ensureCollection(name);
          results.push({ name, ok: true });
        } catch (err) {
          results.push({ name, ok: false, error: err.message || err.errMsg });
        }
      }
      const ok = results.every(r => r.ok);
      return { success: ok, results };
    }

    // ── 调试 ────────────────────────────────────
    case "getOpenId": {
      return { success: true, data: { openid, appid: wxContext.APPID } };
    }

    default:
      return { success: false, error: `未知操作类型: ${type}` };
  }
};
