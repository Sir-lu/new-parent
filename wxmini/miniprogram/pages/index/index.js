const { SCENE_CATEGORIES } = require("../../utils/scenes.js");
const { birthYearToAge } = require("../../utils/childProfile.js");

Page({
  data: {
    categories: SCENE_CATEGORIES,
    expandedId: null,
    selectedChild: null     // 当前选中的孩子
  },

  onShow() {
    wx.setNavigationBarTitle({ title: "新父母急救箱" });
    // 加载选中的孩子
    const app = getApp();
    const child = app.globalData.selectedChild;
    if (child) {
      const age = birthYearToAge(child.birthYear);
      this.setData({ selectedChild: { ...child, age }});
    } else {
      this.setData({ selectedChild: null });
    }
  },

  // 跳转到孩子档案管理
  toProfileList() {
    wx.navigateTo({ url: "/pages/profile/list" });
  },

  toggleCategory(e) {
    const { id } = e.currentTarget.dataset;
    this.setData({
      expandedId: this.data.expandedId === id ? null : id
    });
  },

  selectScene(e) {
    const { scene, category } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/ask/ask?sceneId=${scene.id}&sceneName=${scene.name}&categoryName=${category.name}`
    });
  }
});
