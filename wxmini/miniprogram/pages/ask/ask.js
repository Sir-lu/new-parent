const { birthYearToAge, profileToContext, PERSONALITY_OPTIONS } = require("../../utils/childProfile.js");

Page({
  data: {
    sceneId: "",
    sceneName: "",
    categoryName: "",
    userInput: "",
    submitting: false,
    selectedChild: null,
    placeholder: "用语音或文字说说发生了什么…\n\n比如：刚才接孩子放学，她说想买蜜雪冰城，我说了一句你这一周不白练了吗，她脸就拉下来了，然后哭…"
  },

  onShow() {
    this.loadSelectedChild();
  },

  onLoad(options) {
    const { sceneId, sceneName, categoryName } = options;
    this.setData({ sceneId, sceneName, categoryName });
    wx.setNavigationBarTitle({
      title: sceneName ? `场景：${sceneName}` : "描述问题"
    });
    this.loadSelectedChild();
  },

  // 加载当前选中的孩子
  loadSelectedChild() {
    const app = getApp();
    const child = app.globalData.selectedChild;
    if (child) {
      const age = birthYearToAge(child.birthYear);
      const personalityLabels = (child.personality || [])
        .map(v => PERSONALITY_OPTIONS.find(p => p.value === v))
        .filter(Boolean)
        .map(p => p.label);
      this.setData({
        selectedChild: { ...child, age, personalityDisplay: personalityLabels.join("、") }
      });
    } else {
      this.setData({ selectedChild: null });
    }
  },

  // 跳转到档案管理
  toProfileList() {
    wx.navigateTo({ url: "/pages/profile/list" });
  },

  onInput(e) {
    this.setData({ userInput: e.detail.value });
  },

  // 提交 → 调用云函数
  submitQuestion() {
    const { userInput, sceneId, sceneName, categoryName, selectedChild } = this.data;

    if (!userInput.trim()) {
      wx.showToast({ title: "请先说说发生了什么", icon: "none" });
      return;
    }
    if (userInput.trim().length < 10) {
      wx.showToast({ title: "描述再详细一点会更好", icon: "none" });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: "正在分析中…", mask: true });

    // 构建孩子上下文
    const childContext = selectedChild ? profileToContext(selectedChild) : "";

    wx.cloud.callFunction({
      name: "parentAI",
      data: {
        type: "askAI",
        scene: sceneName,
        category: categoryName,
        userInput: userInput.trim(),
        childContext: childContext      // ← 新增：孩子档案上下文
      }
    }).then(resp => {
      wx.hideLoading();
      this.setData({ submitting: false });

      if (resp.result && resp.result.success) {
        const answerData = resp.result.data;
        const app = getApp();
        app.globalData.lastAnswer = answerData;
        app.globalData.lastQuestion = {
          sceneId, sceneName, categoryName,
          question: userInput.trim(),
          childName: selectedChild ? selectedChild.name : ""
        };

        wx.navigateTo({ url: "/pages/answer/answer" });
      } else {
        wx.showModal({
          title: "出错了",
          content: resp.result?.error || "请稍后重试",
          showCancel: false
        });
      }
    }).catch(err => {
      wx.hideLoading();
      this.setData({ submitting: false });
      console.error("云函数调用失败:", err);
      wx.showModal({
        title: "网络异常",
        content: "请检查网络后重试。",
        showCancel: false
      });
    });
  }
});
