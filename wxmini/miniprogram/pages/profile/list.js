const { birthYearToAge, ageToStage, PERSONALITY_OPTIONS } = require("../../utils/childProfile.js");
const { ensureLogin } = require("../../utils/auth.js");

Page({
  data: {
    children: [],
    loading: true,
    selectedId: ""
  },

  onShow() {
    const app = getApp();
    if (!app.globalData.isLoggedIn) {
      ensureLogin().catch(() => {
        wx.navigateBack({ delta: 1 });
      });
      return;
    }
    this.loadChildren();
  },

  // 从云数据库加载孩子列表
  loadChildren() {
    this.setData({ loading: true });
    const app = getApp();
    const selectedId = app.globalData.selectedChildId || "";

    wx.cloud.callFunction({
      name: "parentAI",
      data: { type: "listChildren" }
    }).then(resp => {
      const children = (resp.result && resp.result.data) ? resp.result.data : [];
      // 附加派生字段
      children.forEach(c => {
        c.age = birthYearToAge(c.birthYear);
        c.stage = ageToStage(c.age);
        c.personalityLabels = (c.personality || [])
          .map(v => PERSONALITY_OPTIONS.find(p => p.value === v))
          .filter(Boolean)
          .map(p => p.label);
      });
      this.setData({ children, loading: false, selectedId });
    }).catch(err => {
      console.error("加载孩子列表失败:", err);
      // fallback: 从本地加载
      const local = wx.getStorageSync("local_children") || [];
      local.forEach(c => {
        c._id = c._id || `local_${Date.now()}`;
        c.age = birthYearToAge(c.birthYear);
        c.stage = ageToStage(c.age);
      });
      this.setData({ children: local, loading: false, selectedId });
    });
  },

  // 选择孩子
  selectChild(e) {
    const { id } = e.currentTarget.dataset;
    const app = getApp();
    const child = this.data.children.find(c => c._id === id) || null;
    app.setSelectedChild(id, child);
    this.setData({ selectedId: id });

    wx.showToast({ title: "已选择", icon: "success", duration: 800 });
    setTimeout(() => wx.navigateBack(), 600);
  },

  // 新建孩子
  addChild() {
    wx.navigateTo({ url: "/pages/profile/edit" });
  },

  // 编辑孩子
  editChild(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/profile/edit?id=${id}` });
  },

  // 删除孩子
  deleteChild(e) {
    const { id, name } = e.currentTarget.dataset;
    wx.showModal({
      title: "删除档案",
      content: `确定删除「${name}」的档案吗？数据不可恢复。`,
      confirmColor: "#E8784A",
      success: (res) => {
        if (res.confirm) {
          wx.cloud.callFunction({
            name: "parentAI",
            data: { type: "deleteChild", childId: id }
          }).then(() => {
            this.loadChildren();
            // 如果删除的是当前选中的，清除选择
            const app = getApp();
            if (app.globalData.selectedChildId === id) {
              app.setSelectedChild("", null);
            }
          }).catch(() => {
            // 本地删除
            let local = wx.getStorageSync("local_children") || [];
            local = local.filter(c => c._id !== id);
            wx.setStorageSync("local_children", local);
            this.loadChildren();
          });
        }
      }
    });
  }
});
