// app.js — 新父母急救箱
App({
  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
      return;
    }

    wx.cloud.init({
      // env 参数：填入你的云环境 ID
      // 在微信开发者工具右上角 → 云开发按钮 → 设置 → 环境 ID 查看
      env: "",
      traceUser: true
    });

    // 全局数据：用于页面间数据传递
    this.globalData = {
      lastAnswer: null,    // AI 回答结果
      lastQuestion: null   // 用户问题信息
    };
  },

  globalData: {
    lastAnswer: null,
    lastQuestion: null
  }
});
