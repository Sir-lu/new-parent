// app.js — 新父母急救箱
const { isProfileComplete } = require("./utils/auth.js");

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
    const loggedIn = isProfileComplete(savedUser);

    this.globalData = {
      lastAnswer: null,
      lastQuestion: null,
      selectedChildId: savedChildId,
      selectedChild: savedChild,
      isLoggedIn: loggedIn,
      openid: savedUser ? savedUser.openid : "",
      userInfo: loggedIn ? savedUser : null
    };

    // 本地缓存资料不完整时清除，避免误判为已登录
    if (savedUser && !loggedIn) {
      wx.removeStorageSync("userInfo");
      this.globalData.openid = "";
    }

    // 资料完整的用户启动时静默续登
    if (loggedIn) {
      this.checkLogin({ silent: true }).catch(() => {
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
    if (!isProfileComplete(userInfo)) return;
    this.globalData.isLoggedIn = true;
    this.globalData.openid = userInfo.openid;
    this.globalData.userInfo = userInfo;
    wx.setStorageSync("userInfo", userInfo);
  },

  // 检查登录状态，判断是否首次登录
  checkLogin(options = {}) {
    const { silent = false } = options;

    return new Promise((resolve, reject) => {
      if (!silent) {
        wx.showLoading({ title: "登录中…", mask: true });
      }

      wx.login({
        success: () => {
          wx.cloud.callFunction({
            name: "parentAI",
            data: { type: "checkUser" }
          }).then(resp => {
            if (!silent) wx.hideLoading();

            if (resp.result && resp.result.success) {
              if (resp.result.needProfileSetup) {
                if (silent) this.clearLogin();
              } else if (resp.result.data) {
                this.saveLogin(resp.result.data);
              }
              resolve(resp.result);
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

  // 首次登录完善资料后保存昵称/头像
  completeProfile(nickName, avatarFileID) {
    return new Promise((resolve, reject) => {
      wx.showLoading({ title: "保存中…", mask: true });

      wx.cloud.callFunction({
        name: "parentAI",
        data: { type: "login", nickName, avatarFileID }
      }).then(resp => {
        wx.hideLoading();

        if (resp.result && resp.result.success && resp.result.data) {
          this.saveLogin(resp.result.data);
          wx.showToast({ title: "登录成功", icon: "success", duration: 1200 });
          resolve(resp.result.data);
        } else {
          const errMsg = resp.result?.error || "保存失败，请重试";
          wx.showToast({ title: errMsg, icon: "none" });
          reject(new Error(errMsg));
        }
      }).catch(err => {
        wx.hideLoading();
        wx.showToast({ title: "保存失败，请检查网络", icon: "none" });
        reject(err);
      });
    });
  },

  logout() {
    this.clearLogin();
    wx.showToast({ title: "已退出登录", icon: "none" });
  }
});
