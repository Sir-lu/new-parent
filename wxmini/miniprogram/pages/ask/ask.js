Page({
  data: {
    sceneId: "",
    sceneName: "",
    categoryName: "",
    userInput: "",
    submitting: false,
    placeholder: "用语音或文字说说发生了什么…\n\n比如：刚才接孩子放学，她说想买蜜雪冰城，我说了一句你这一周不白练了吗，她脸就拉下来了，然后哭…"
  },

  onLoad(options) {
    const { sceneId, sceneName, categoryName } = options;
    this.setData({ sceneId, sceneName, categoryName });
    wx.setNavigationBarTitle({
      title: sceneName ? `场景：${sceneName}` : "描述问题"
    });
  },

  onInput(e) {
    this.setData({ userInput: e.detail.value });
  },

  // 提交 → 调用云函数 → 跳转回答页
  submitQuestion() {
    const { userInput, sceneId, sceneName, categoryName } = this.data;

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

    wx.cloud.callFunction({
      name: "parentAI",
      data: {
        type: "askAI",
        scene: sceneName,
        category: categoryName,
        userInput: userInput.trim()
      }
    }).then(resp => {
      wx.hideLoading();
      this.setData({ submitting: false });

      if (resp.result && resp.result.success) {
        const answerData = resp.result.data;
        // 存入全局变量，供 answer 页使用
        const app = getApp();
        app.globalData.lastAnswer = answerData;
        app.globalData.lastQuestion = {
          sceneId, sceneName, categoryName,
          question: userInput.trim()
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
        content: "请检查网络后重试。如果持续失败，可能是云函数未部署。",
        showCancel: false
      });
    });
  }
});
