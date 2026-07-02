const { isProfileComplete } = require("../../utils/auth.js");

Page({
  data: {
    isLoggedIn: false,
    showProfileSetup: false,
    profileSetupDesc: "请设置昵称和头像",
    loggingIn: false,
    userInfo: {},
    nickName: "",
    avatarUrl: ""
  },

  onShow() {
    const app = getApp();
    this.setData({
      isLoggedIn: app.globalData.isLoggedIn && isProfileComplete(app.globalData.userInfo),
      userInfo: app.globalData.userInfo || {},
      showProfileSetup: false
    });
  },

  openProfileSetup(result) {
    const partial = result.partialProfile || {};
    this.setData({
      showProfileSetup: true,
      loggingIn: false,
      profileSetupDesc: result.isNewUser
        ? "首次登录，请设置昵称和头像"
        : "请完善昵称和头像后再继续使用",
      nickName: partial.nickName || "",
      avatarUrl: partial.avatarUrl || ""
    });
  },

  handleLogin() {
    if (this.data.loggingIn) return;
    this.setData({ loggingIn: true });

    getApp().checkLogin()
      .then(result => {
        if (result.needProfileSetup) {
          this.openProfileSetup(result);
        } else {
          this.setData({
            isLoggedIn: true,
            userInfo: getApp().globalData.userInfo || {},
            loggingIn: false
          });
          wx.showToast({ title: "登录成功", icon: "success" });
        }
      })
      .catch(() => {
        this.setData({ loggingIn: false });
      });
  },

  onChooseAvatar(e) {
    this.setData({ avatarUrl: e.detail.avatarUrl });
  },

  onNickNameInput(e) {
    this.setData({ nickName: e.detail.value });
  },

  handleCompleteProfile() {
    const { nickName, avatarUrl, loggingIn } = this.data;
    if (loggingIn) return;

    if (!nickName.trim()) {
      wx.showToast({ title: "请填写昵称", icon: "none" });
      return;
    }
    if (!avatarUrl) {
      wx.showToast({ title: "请设置头像", icon: "none" });
      return;
    }

    this.setData({ loggingIn: true });

    const uploadAvatar = avatarUrl.startsWith("cloud://")
      ? Promise.resolve({ fileID: avatarUrl })
      : wx.cloud.uploadFile({
        cloudPath: `avatars/${Date.now()}-${Math.floor(Math.random() * 10000)}.jpg`,
        filePath: avatarUrl
      });

    uploadAvatar.then(uploadRes => {
      return getApp().completeProfile(nickName.trim(), uploadRes.fileID);
    }).then(userInfo => {
      this.setData({
        isLoggedIn: true,
        userInfo,
        showProfileSetup: false,
        loggingIn: false,
        nickName: "",
        avatarUrl: ""
      });
    }).catch(() => {
      this.setData({ loggingIn: false });
    });
  },

  cancelProfileSetup() {
    this.setData({
      showProfileSetup: false,
      nickName: "",
      avatarUrl: ""
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
          this.setData({ isLoggedIn: false, userInfo: {}, showProfileSetup: false });
        }
      }
    });
  },

  goProfile() {
    wx.navigateTo({ url: "/pages/profile/list" });
  }
});
