const { profileToContext } = require("../../utils/childProfile.js");
const { ensureLogin } = require("../../utils/auth.js");
const { formatHistoryTime, historyPreview } = require("../../utils/history.js");

Page({
  data: {
    messages: [],
    children: [],
    selectedChildId: "",
    inputText: "",
    scrollTo: "",
    sending: false,
    isLoggedIn: false,
    drawerOpen: false,
    historyList: [],
    historyLoading: false,
    statusBarHeight: 20
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: windowInfo.statusBarHeight || 20
    });
  },

  onShow() {
    const app = getApp();
    this.setData({ isLoggedIn: app.globalData.isLoggedIn });
    this.loadChildren();
  },

  loadChildren() {
    const app = getApp();
    if (!app.globalData.isLoggedIn) {
      this.setData({ children: [], selectedChildId: "" });
      return;
    }
    wx.cloud.callFunction({
      name: "parentAI",
      data: { type: "listChildren" }
    }).then(resp => {
      const children = (resp.result && resp.result.data) ? resp.result.data : [];
      let selectedChildId = app.globalData.selectedChildId || "";
      if (!children.find(c => c._id === selectedChildId)) {
        selectedChildId = children.length > 0 ? children[0]._id : "";
      }
      this.setData({ children, selectedChildId });
    }).catch(() => {
      this.setData({ children: [], selectedChildId: "" });
    });
  },

  // 选择本次问题针对的孩子
  pickChild(e) {
    const { id } = e.currentTarget.dataset;
    const child = this.data.children.find(c => c._id === id) || null;
    const app = getApp();
    app.setSelectedChild(id, child);
    this.setData({ selectedChildId: id });
  },

  toProfileList() {
    wx.navigateTo({ url: "/pages/profile/list" });
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  preventMove() {},

  openDrawer() {
    if (!getApp().globalData.isLoggedIn) {
      ensureLogin();
      return;
    }
    this.setData({ drawerOpen: true });
    this.loadHistory();
  },

  closeDrawer() {
    this.setData({ drawerOpen: false });
  },

  loadHistory() {
    this.setData({ historyLoading: true });
    wx.cloud.callFunction({
      name: "parentAI",
      data: { type: "getHistory" }
    }).then(resp => {
      const raw = (resp.result && resp.result.data) ? resp.result.data : [];
      const historyList = raw.map(item => ({
        ...item,
        title: (item.question || "").trim().slice(0, 36) || "无标题",
        preview: historyPreview(item).slice(0, 48),
        timeText: formatHistoryTime(item.createdAt)
      }));
      this.setData({ historyList, historyLoading: false });
    }).catch(() => {
      this.setData({ historyList: [], historyLoading: false });
    });
  },

  openHistoryItem(e) {
    const { id } = e.currentTarget.dataset;
    const item = this.data.historyList.find(h => h._id === id);
    if (!item) return;

    const answer = item.answer || {};
    const messages = [
      { id: id + "_u", role: "user", text: item.question },
      {
        ...answer,
        id: id + "_a",
        role: "ai",
        loading: false,
        showDetail: false,
        rating: item.rating || 0,
        _id: id
      }
    ];

    this.setData({
      messages,
      drawerOpen: false,
      scrollTo: "msg-bottom"
    });
  },

  startNewChat() {
    this.setData({
      messages: [],
      inputText: "",
      drawerOpen: false,
      scrollTo: ""
    });
  },

  // 发送消息
  sendMessage() {
    const text = this.data.inputText.trim();
    if (!text || this.data.sending) return;

    ensureLogin().then(() => {
      this._doSendMessage(text);
    }).catch(() => {});
  },

  _doSendMessage(text) {
    const msgId = Date.now().toString();
    const selectedChild = this.data.children.find(c => c._id === this.data.selectedChildId) || null;

    // 添加用户消息
    const userMsg = { id: msgId + "_u", role: "user", text };
    // 添加 AI 占位（加载中）
    const aiMsg = { id: msgId + "_a", role: "ai", loading: true, rating: 0 };

    const messages = [...this.data.messages, userMsg, aiMsg];
    this.setData({ messages, inputText: "", scrollTo: "msg-bottom", sending: true });

    // 构建孩子上下文，让 AI 回复更贴合孩子的实际情况
    const childContext = selectedChild ? profileToContext(selectedChild) : "";

    // 调用云函数
    wx.cloud.callFunction({
      name: "parentAI",
      data: {
        type: "askAI",
        scene: "日常沟通",
        category: "",
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
        if (resp.result && resp.result.needLogin) {
          getApp().clearLogin();
          this.setData({ isLoggedIn: false, children: [], selectedChildId: "" });
          ensureLogin();
        }
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
