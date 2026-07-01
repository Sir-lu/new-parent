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

/**
 * 检查用户输入是否包含高风险信号
 */
function detectCrisis(text) {
  return CRISIS_KEYWORDS.some(kw => text.includes(kw));
}

/**
 * 调用 DeepSeek API
 */
function callDeepSeek(systemPrompt, userMessage) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: "deepseek-chat",
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
      timeout: 25000
    }, (res) => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => {
        try {
          const result = JSON.parse(body);
          if (result.choices && result.choices[0]) {
            const content = result.choices[0].message.content;
            resolve(JSON.parse(content));
          } else {
            reject(new Error("DeepSeek 返回格式异常: " + body.slice(0, 200)));
          }
        } catch (e) {
          reject(new Error("解析 DeepSeek 响应失败: " + e.message));
        }
      });
    });

    req.on("error", (e) => reject(new Error("DeepSeek API 请求失败: " + e.message)));
    req.on("timeout", () => { req.destroy(); reject(new Error("DeepSeek API 超时")); });
    req.write(postData);
    req.end();
  });
}

/**
 * 错误降级：返回预置话术
 */
function fallbackResponse(scene, userInput) {
  return {
    rootCause: "（AI 暂时不可用）从你的描述来看，这符合家庭教育中常见的行为模式。",
    emotionalCheck: "我听到了你的困扰。面对孩子的时候，有情绪是正常的——你不是一个人。",
    steps: [
      {
        step: 1,
        action: "先暂停一下，深呼吸三次。确保自己不是在情绪爆发状态下跟孩子沟通。",
        principle: "建设性解决问题（启发式5）"
      },
      {
        step: 2,
        action: "等双方都冷静下来后，用"情感反映"的方式开启对话——先说出孩子的感受，再说你的想法。",
        principle: "情感反映先行（启发式1）"
      },
      {
        step: 3,
        action: "和孩子一起商量解决方案——给他两个你都能接受的选择，让他来决定。",
        principle: "给孩子选择权（启发式4）"
      }
    ],
    keyInsight: "在情绪上脑的时候，最好的教育是暂停——不是不管，是先管好自己的情绪再管孩子。",
    script: "（AI 恢复后会自动生成适合你场景的沟通话术）",
    methodTags: ["情感反映先行", "建设性解决问题", "给孩子选择权"],
    isFallback: true
  };
}

/**
 * 云函数入口
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const { type, scene, category, userInput, questionId, rating } = event;

  switch (type) {

    // ── 核心：AI 问答 ──────────────────────────────
    case "askAI": {
      if (!scene || !userInput) {
        return { success: false, error: "缺少 scene 或 userInput 参数" };
      }

      // 高风险检测
      if (detectCrisis(userInput)) {
        return {
          success: true,
          data: {
            rootCause: "",
            emotionalCheck: "你描述的情况可能需要专业支持。",
            steps: [{
              step: 1,
              action: "建议咨询儿童心理医生或拨打 12355 青少年服务热线。",
              principle: "专业支持"
            }],
            keyInsight: "有些问题超出了家庭教育的范畴，寻求专业帮助是对孩子和自己负责的表现。",
            script: "",
            methodTags: ["专业支持"],
            disclaimer: "本建议不替代专业心理咨询。如果你或孩子处于危险中，请立即寻求帮助。",
            isCrisis: true
          }
        };
      }

      // 构建 prompt
      const { system, user } = buildPrompt(scene, category, userInput);

      // 调用 LLM
      let aiResult;
      try {
        aiResult = await callDeepSeek(system, user);
      } catch (err) {
        console.error("LLM 调用失败:", err.message);
        aiResult = fallbackResponse(scene, userInput);
      }

      // 写入云数据库
      try {
        const doc = {
          openid,
          scene,
          category: category || "",
          question: userInput.slice(0, 500),  // 截断以防超长
          answer: aiResult,
          rating: 0,
          createdAt: db.serverDate(),
        };
        const result = await db.collection("questions").add({ data: doc });
        aiResult._id = result._id;
      } catch (dbErr) {
        console.error("数据库写入失败:", dbErr.message);
        // 不影响返回——即使数据库写入失败，AI 答案仍然有效
      }

      // 追加免责声明
      aiResult.disclaimer = "本建议基于帆书新父母教育方法论，仅供参考，不替代专业心理咨询。每个孩子都是独特的生命体，请结合实际情况判断。";

      return { success: true, data: aiResult };
    }

    // ── 提交评分 ──────────────────────────────
    case "rateAnswer": {
      if (!questionId || rating === undefined) {
        return { success: false, error: "缺少 questionId 或 rating 参数" };
      }

      try {
        // 更新 questions 集合中的评分
        await db.collection("questions").doc(questionId).update({
          data: { rating, ratedAt: db.serverDate() }
        });

        // 同时写入独立的 feedback 集合
        await db.collection("feedback").add({
          data: {
            openid,
            questionId,
            rating,
            createdAt: db.serverDate()
          }
        });

        return { success: true };
      } catch (err) {
        console.error("评分提交失败:", err.message);
        return { success: false, error: err.message };
      }
    }

    // ── 获取用户历史 ──────────────────────────
    case "getHistory": {
      try {
        const { data } = await db.collection("questions")
          .where({ openid })
          .orderBy("createdAt", "desc")
          .limit(20)
          .get();
        return { success: true, data };
      } catch (err) {
        return { success: false, error: err.message, data: [] };
      }
    }

    // ── 获取单个回答（用于分享/回看）───────────
    case "getAnswer": {
      if (!questionId) {
        return { success: false, error: "缺少 questionId" };
      }
      try {
        const { data } = await db.collection("questions").doc(questionId).get();
        return { success: true, data: data[0] || null };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    // ── 获取 openId（调试用）───────────────────
    case "getOpenId": {
      return {
        success: true,
        data: { openid, appid: wxContext.APPID }
      };
    }

    default:
      return { success: false, error: `未知操作类型: ${type}` };
  }
};
