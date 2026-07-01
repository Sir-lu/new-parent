// 登录状态工具

function ensureLogin(options = {}) {
  const app = getApp();
  if (app.globalData.isLoggedIn && app.globalData.openid) {
    return Promise.resolve(app.globalData.userInfo);
  }

  const { silent = false } = options;
  if (!silent) {
    return new Promise((resolve, reject) => {
      wx.showModal({
        title: "需要登录",
        content: "登录后，宝贝档案和咨询记录才会保存到您的微信账号。",
        confirmText: "去登录",
        confirmColor: "#5B8BA0",
        success(res) {
          if (res.confirm) {
            wx.switchTab({ url: "/pages/mine/index" });
          }
          reject(new Error("未登录"));
        }
      });
    });
  }

  return Promise.reject(new Error("未登录"));
}

module.exports = { ensureLogin };
