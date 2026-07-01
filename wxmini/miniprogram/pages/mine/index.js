const { birthYearToAge, ageToStage, PERSONALITY_OPTIONS } = require("../../utils/childProfile.js");

Page({
  data: {
    children: [],
    selectedId: "",
    loading: true
  },

  onShow() {
    this.loadChildren();
  },

  loadChildren() {
    this.setData({ loading: true });
    const app = getApp();
    const selectedId = app.globalData.selectedChildId || "";

    wx.cloud.callFunction({
      name: "parentAI",
      data: { type: "listChildren" }
    }).then(resp => {
      const children = (resp.result && resp.result.data) ? resp.result.data : [];
      children.forEach(c => {
        c.age = birthYearToAge(c.birthYear);
        c.stage = ageToStage(c.age);
        c.personalityLabels = (c.personality || [])
          .map(v => PERSONALITY_OPTIONS.find(p => p.value === v))
          .filter(Boolean)
          .map(p => p.label);
      });
      this.setData({ children, loading: false, selectedId });
    }).catch(() => {
      const local = wx.getStorageSync("local_children") || [];
      local.forEach(c => {
        c.age = birthYearToAge(c.birthYear);
        c.stage = ageToStage(c.age);
      });
      this.setData({ children: local, loading: false, selectedId });
    });
  },

  selectChild(e) {
    const { id } = e.currentTarget.dataset;
    const app = getApp();
    const child = this.data.children.find(c => c._id === id) || null;
    app.setSelectedChild(id, child);
    this.setData({ selectedId: id });
    wx.showToast({ title: "已切换", icon: "success", duration: 600 });
  },

  addChild() {
    wx.navigateTo({ url: "/pages/profile/edit" });
  },

  editChild(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/profile/edit?id=${id}` });
  },

  deleteChild(e) {
    const { id, name } = e.currentTarget.dataset;
    wx.showModal({
      title: "删除档案",
      content: `确定删除「${name}」的档案吗？`,
      confirmColor: "#5B8BA0",
      success: (res) => {
        if (res.confirm) {
          wx.cloud.callFunction({
            name: "parentAI",
            data: { type: "deleteChild", childId: id }
          }).then(() => this.loadChildren())
            .catch(() => this.loadChildren());
        }
      }
    });
  }
});
