const { SCENE_CATEGORIES } = require("../../utils/scenes.js");
const { birthYearToAge, profileToContext, PERSONALITY_OPTIONS } = require("../../utils/childProfile.js");

// 展开所有场景为扁平数组
function flattenScenes() {
  const result = [];
  SCENE_CATEGORIES.forEach(cat => {
    cat.scenes.forEach(scene => {
      result.push({ ...scene, category: cat.name });
    });
  });
  return result;
}

Page({
  data: {
    messages: [],          // 对话列表
    allScenes: flattenScenes(),
    activeScene: "",
    inputText: "",
    scrollTo: "",
    selectedChild: null,
    sending: false
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: "新父母急救箱" });
    this.setData({ allScenes: flattenScenes() });
  },

  onShow() {
    this.loadChild();
  },

  loadChild() {
    const app = getApp();
    const child = app.globalData.selectedChild;
    if (child) {
      const age = birthYearToAge(child.birthYear);
      const gender = child.gender || "";
      const icon = gender === "boy" ? "👦" : (gender === "girl" ? "👧" : "👤");
      this.setData({ selectedChild: { ...child, age, icon }});
    } else {
      this.setData({ selectedChild: null });
    }
  },

  // 选择/取消场景
  pickScene(e) {
    const { scene } = e.currentTarget.dataset;
    if (this.data.activeScene === scene.id) {
      this.setData({ activeScene: "" });
    } else {
      this.setData({ activeScene: scene.id });
    }
  },

  toProfileList() {
    wx.navigateTo({ url: "/pages/profile/list" });
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  // 发送消息
  sendMessage() {
    const text = this.data.inputText.trim();
    if (!text || this.data.sending) return;

    const msgId = Date.now().toString();
    const sceneObj = this.data.allScenes.find(s => s.id === this.data.activeScene);
    const selectedChild = this.data.selectedChild;

    // 添加用户消息
    const userMsg = { id: msgId + "_u", role: "user", text };
    // 添加 AI 占位（加载中）
    const aiMsg = { id: msgId + "_a", role: "ai", loading: true, rating: 0 };

    const messages = [...this.data.messages, userMsg, aiMsg];
    this.setData({ messages, inputText: "", scrollTo: "msg-bottom", sending: true });

    // 构建孩子上下文
    const childContext = selectedChild ? profileToContext(selectedChild) : "";
    const sceneName = sceneObj ? sceneObj.name : "";
    const categoryName = sceneObj ? sceneObj.category : "";

    // 调用云函数
    wx.cloud.callFunction({
      name: "parentAI",
      data: {
        type: "askAI",
        scene: sceneName || "未指定",
        category: categoryName || "",
        userInput: text,
        childContext
      }
    }).then(resp => {
      const idx = messages.length - 1;
      if (resp.result && resp.result.success) {
        const data = resp.result.data;
        messages[idx] = {
          ...data,
          id: msgId + "_a",
          role: "ai",
          loading: false,
          showDetail: false,
          rating: 0
        };
      } else {
        messages[idx] = {
          id: msgId + "_a",
          role: "ai",
          loading: false,
          emotionalCheck: "抱歉，出了点问题。",
          script: resp.result?.error || "请稍后重试",
          rating: 0
        };
      }
      this.setData({ messages, sending: false, scrollTo: "msg-bottom" });
    }).catch(err => {
      console.error("发送失败:", err);
      const idx = messages.length - 1;
      messages[idx] = {
        id: msgId + "_a",
        role: "ai",
        loading: false,
        emotionalCheck: "网络出了点问题",
        script: "请检查网络后重试。",
        rating: 0
      };
      this.setData({ messages, sending: false, scrollTo: "msg-bottom" });
    });
  },

  // 展开/收起详细信息
  toggleDetail(e) {
    const { index } = e.currentTarget.dataset;
    const messages = this.data.messages;
    messages[index].showDetail = !messages[index].showDetail;
    this.setData({ messages });
  },

  // 评分
  rateMessage(e) {
    const { index, rating } = e.currentTarget.dataset;
    const messages = this.data.messages;
    messages[index].rating = rating;
    this.setData({ messages });

    // 提交评分到后端
    if (messages[index]._id) {
      wx.cloud.callFunction({
        name: "parentAI",
        data: { type: "rateAnswer", questionId: messages[index]._id, rating }
      }).catch(() => {});
    }
  }
});
