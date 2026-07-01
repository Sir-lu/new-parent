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
    // 从本地恢复上次选中的孩子
    const savedChildId = wx.getStorageSync("selectedChildId") || "";
    const savedChild = wx.getStorageSync("selectedChild") || null;

    this.globalData = {
      lastAnswer: null,
      lastQuestion: null,
      selectedChildId: savedChildId,
      selectedChild: savedChild
    };
  },

  globalData: {
    lastAnswer: null,
    lastQuestion: null,
    selectedChildId: "",
    selectedChild: null
  },

  // 设置当前选中的孩子，并持久化到本地
  setSelectedChild(id, child) {
    this.globalData.selectedChildId = id;
    this.globalData.selectedChild = child;
    wx.setStorageSync("selectedChildId", id);
    if (child) wx.setStorageSync("selectedChild", child);
    else wx.removeStorageSync("selectedChild");
  }
});
