Page({
  data: {
    answer: null,
    question: null,
    rated: false,
    rating: 0
  },

  onLoad() {
    const app = getApp();
    const answer = app.globalData.lastAnswer;
    const question = app.globalData.lastQuestion;

    if (!answer) {
      wx.showModal({
        title: "提示",
        content: "没有找到分析结果，请返回重新提问。",
        showCancel: false,
        success: () => wx.navigateBack()
      });
      return;
    }

    this.setData({ answer, question });

    // 保存到本地历史
    this.saveToLocalHistory(answer, question);
  },

  // 本地缓存历史（无需登录即可查看历史）
  saveToLocalHistory(answer, question) {
    try {
      const history = wx.getStorageSync("parent_ai_history") || [];
      history.unshift({
        answer,
        question,
        time: new Date().toISOString()
      });
      // 保留最近 50 条
      if (history.length > 50) history.length = 50;
      wx.setStorageSync("parent_ai_history", history);
    } catch (e) {
      // 静默失败
    }
  },

  // 评分
  rateAnswer(e) {
    const { rating } = e.currentTarget.dataset;
    if (this.data.rated) return;

    this.setData({ rated: true, rating });

    // 提交评分到云函数
    if (this.data.answer._id) {
      wx.cloud.callFunction({
        name: "parentAI",
        data: {
          type: "rateAnswer",
          questionId: this.data.answer._id,
          rating
        }
      }).catch(() => {});
    }

    const emoji = rating >= 4 ? "🎉" : rating >= 3 ? "🙏" : "💪";
    wx.showToast({ title: `${emoji} 感谢反馈！`, icon: "none" });
  },

  // 返回首页再问一次
  askAgain() {
    wx.navigateBack({ delta: 2 }); // 跳回首页
  }
});
