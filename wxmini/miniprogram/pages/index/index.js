const { SCENE_CATEGORIES } = require("../../utils/scenes.js");

Page({
  data: {
    categories: SCENE_CATEGORIES,
    expandedId: null
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: "新父母急救箱" });
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
