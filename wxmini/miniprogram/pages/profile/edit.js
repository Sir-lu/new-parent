const {
  PERSONALITY_OPTIONS, BIRTH_ORDER_OPTIONS,
  GRADE_OPTIONS, GENDER_OPTIONS, birthYearToAge
} = require("../../utils/childProfile.js");

Page({
  data: {
    isEdit: false,
    childId: "",
    // 表单
    name: "",
    birthYear: "",
    gender: "",
    grade: "",
    personality: [],       // 选中的 value 数组
    birthOrder: "",
    notes: "",
    // 选项列表
    personalityOptions: PERSONALITY_OPTIONS,
    birthOrderOptions: BIRTH_ORDER_OPTIONS,
    gradeOptions: GRADE_OPTIONS,
    genderOptions: GENDER_OPTIONS,
    // 派生
    computedAge: null,
    personalityDisplay: "",
    submitting: false
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ isEdit: true, childId: options.id });
      wx.setNavigationBarTitle({ title: "编辑档案" });
      this.loadChild(options.id);
    } else {
      wx.setNavigationBarTitle({ title: "添加孩子" });
    }
  },

  loadChild(id) {
    wx.showLoading({ title: "加载中…" });
    wx.cloud.callFunction({
      name: "parentAI",
      data: { type: "getChild", childId: id }
    }).then(resp => {
      wx.hideLoading();
      if (resp.result && resp.result.data) {
        const c = resp.result.data;
        this.setData({
          name: c.name || "",
          birthYear: c.birthYear ? String(c.birthYear) : "",
          gender: c.gender || "",
          grade: c.grade || "",
          personality: c.personality || [],
          birthOrder: c.birthOrder || "",
          notes: c.notes || ""
        });
        this.updateComputed();
      }
    }).catch(() => {
      wx.hideLoading();
      // 从本地找
      const local = wx.getStorageSync("local_children") || [];
      const c = local.find(x => x._id === id);
      if (c) {
        this.setData({
          name: c.name || "", birthYear: String(c.birthYear || ""),
          gender: c.gender || "", grade: c.grade || "",
          personality: c.personality || [], birthOrder: c.birthOrder || "",
          notes: c.notes || ""
        });
        this.updateComputed();
      }
    });
  },

  // ── 字段变更 ─────────────────────
  onNameInput(e) { this.setData({ name: e.detail.value }); },
  onBirthYearInput(e) {
    this.setData({ birthYear: e.detail.value });
    this.updateComputed();
  },
  onNotesInput(e) { this.setData({ notes: e.detail.value }); },

  selectGender(e) { this.setData({ gender: e.currentTarget.dataset.value }); },
  selectGrade(e) { this.setData({ grade: e.currentTarget.dataset.value }); },
  selectBirthOrder(e) { this.setData({ birthOrder: e.currentTarget.dataset.value }); },

  // 性格多选
  togglePersonality(e) {
    const { value } = e.currentTarget.dataset;
    let personality = [...this.data.personality];
    const idx = personality.indexOf(value);
    if (idx >= 0) personality.splice(idx, 1);
    else personality.push(value);
    this.setData({ personality });
    this.updateComputed();
  },

  updateComputed() {
    const age = parseInt(this.data.birthYear)
      ? birthYearToAge(this.data.birthYear)
      : null;
    const labels = this.data.personality
      .map(v => PERSONALITY_OPTIONS.find(p => p.value === v))
      .filter(Boolean)
      .map(p => p.label);
    this.setData({
      computedAge: age,
      personalityDisplay: labels.join("、") || "未选择"
    });
  },

  // ── 提交 ─────────────────────
  submit() {
    const { name, birthYear, gender, personality, isEdit, childId } = this.data;

    if (!name.trim()) { wx.showToast({ title: "请填写昵称", icon: "none" }); return; }
    if (!gender) { wx.showToast({ title: "请选择性别", icon: "none" }); return; }
    if (!birthYear || !/^\d{4}$/.test(birthYear)) {
      wx.showToast({ title: "请填写正确的出生年份（如2020）", icon: "none" }); return;
    }

    const childData = {
      name: name.trim(),
      birthYear: parseInt(birthYear),
      gender,
      grade: this.data.grade,
      personality,
      birthOrder: this.data.birthOrder,
      notes: this.data.notes.trim()
    };

    this.setData({ submitting: true });
    wx.showLoading({ title: "保存中…", mask: true });

    const type = isEdit ? "updateChild" : "addChild";
    const data = isEdit
      ? { type, childId, ...childData }
      : { type, ...childData };

    wx.cloud.callFunction({ name: "parentAI", data })
      .then(resp => {
        wx.hideLoading();
        this.setData({ submitting: false });
        if (resp.result && resp.result.success) {
          // 更新全局选中
          const app = getApp();
          const savedId = resp.result.childId || childId;
          app.globalData.selectedChildId = savedId;
          app.globalData.selectedChild = { _id: savedId, ...childData };

          wx.showToast({ title: isEdit ? "已更新" : "已添加", icon: "success" });
          setTimeout(() => wx.navigateBack(), 800);
        } else {
          wx.showToast({ title: resp.result?.error || "保存失败", icon: "none" });
        }
      })
      .catch(err => {
        wx.hideLoading();
        this.setData({ submitting: false });
        console.error("保存孩子档案失败:", err);
        // 本地 fallback
        const local = wx.getStorageSync("local_children") || [];
        if (isEdit) {
          const idx = local.findIndex(c => c._id === childId);
          if (idx >= 0) local[idx] = { ...local[idx], ...childData };
        } else {
          const newChild = { _id: `local_${Date.now()}`, ...childData };
          local.push(newChild);
        }
        wx.setStorageSync("local_children", local);
        wx.showToast({ title: "已保存到本地", icon: "success" });
        setTimeout(() => wx.navigateBack(), 800);
      });
  }
});
