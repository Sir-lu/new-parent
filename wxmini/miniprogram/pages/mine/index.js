Page({
  data: {
    isLoggedIn: false,
    loggingIn: false
  },

  onShow() {
    const app = getApp();
    this.setData({ isLoggedIn: app.globalData.isLoggedIn });
  },

  handleLogin() {
    if (this.data.loggingIn) return;
    this.setData({ loggingIn: true });

    getApp().login()
      .then(() => {
        this.setData({ isLoggedIn: true, loggingIn: false });
      })
      .catch(() => {
        this.setData({ loggingIn: false });
      });
  },

  handleLogout() {
    wx.showModal({
      title: "退出登录",
      content: "退出后仍可浏览，但新增数据将无法保存到云端。",
      confirmColor: "#5B8BA0",
      success: (res) => {
        if (res.confirm) {
          getApp().logout();
          this.setData({ isLoggedIn: false });
        }
      }
    });
  },

  goProfile() {
    wx.navigateTo({ url: "/pages/profile/list" });
  }
});
