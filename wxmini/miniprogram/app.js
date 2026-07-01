// app.js — 新父母急救箱
App({
  onLaunch() {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
      return;
    }

    wx.cloud.init({
      env: "cloud1-d5g9zm8d813d5e245",
      traceUser: true
    });

    wx.cloud.callFunction({
      name: "parentAI",
      data: { type: "initDatabase" }
    }).catch(() => {});

    const savedChildId = wx.getStorageSync("selectedChildId") || "";
    const savedChild = wx.getStorageSync("selectedChild") || null;
    const savedUser = wx.getStorageSync("userInfo") || null;

    this.globalData = {
      lastAnswer: null,
      lastQuestion: null,
      selectedChildId: savedChildId,
      selectedChild: savedChild,
      isLoggedIn: !!(savedUser && savedUser.openid),
      openid: savedUser ? savedUser.openid : "",
      userInfo: savedUser
    };

    // 已登录用户启动时静默续登
    if (this.globalData.isLoggedIn) {
      this.login({ silent: true }).catch(() => {
        this.clearLogin();
      });
    }
  },

  globalData: {
    lastAnswer: null,
    lastQuestion: null,
    selectedChildId: "",
    selectedChild: null,
    isLoggedIn: false,
    openid: "",
    userInfo: null
  },

  setSelectedChild(id, child) {
    this.globalData.selectedChildId = id;
    this.globalData.selectedChild = child;
    wx.setStorageSync("selectedChildId", id);
    if (child) wx.setStorageSync("selectedChild", child);
    else wx.removeStorageSync("selectedChild");
  },

  clearLogin() {
    this.globalData.isLoggedIn = false;
    this.globalData.openid = "";
    this.globalData.userInfo = null;
    wx.removeStorageSync("userInfo");
  },

  saveLogin(userInfo) {
    this.globalData.isLoggedIn = true;
    this.globalData.openid = userInfo.openid;
    this.globalData.userInfo = userInfo;
    wx.setStorageSync("userInfo", userInfo);
  },

  // 微信登录：wx.login + 云函数获取 openid 并写入 users 集合
  login(options = {}) {
    const { silent = false } = options;

    return new Promise((resolve, reject) => {
      if (!silent) {
        wx.showLoading({ title: "登录中…", mask: true });
      }

      wx.login({
        success: () => {
          wx.cloud.callFunction({
            name: "parentAI",
            data: { type: "login" }
          }).then(resp => {
            if (!silent) wx.hideLoading();

            if (resp.result && resp.result.success && resp.result.data) {
              this.saveLogin(resp.result.data);
              if (!silent) {
                wx.showToast({ title: "登录成功", icon: "success", duration: 1200 });
              }
              resolve(resp.result.data);
            } else {
              const errMsg = resp.result?.error || "登录失败，请重试";
              if (!silent) wx.showToast({ title: errMsg, icon: "none" });
              reject(new Error(errMsg));
            }
          }).catch(err => {
            if (!silent) wx.hideLoading();
            if (!silent) wx.showToast({ title: "登录失败，请检查网络", icon: "none" });
            reject(err);
          });
        },
        fail: err => {
          if (!silent) wx.hideLoading();
          if (!silent) wx.showToast({ title: "微信登录失败", icon: "none" });
          reject(err);
        }
      });
    });
  },

  logout() {
    this.clearLogin();
    wx.showToast({ title: "已退出登录", icon: "none" });
  }
});
