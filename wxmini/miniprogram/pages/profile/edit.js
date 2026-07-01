const {
  PERSONALITY_OPTIONS, BIRTH_ORDER_OPTIONS,
  GRADE_OPTIONS, GENDER_OPTIONS, birthYearToAge
} = require("../../utils/childProfile.js");
const { ensureLogin } = require("../../utils/auth.js");

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
    // 选项列表（带 checked 状态，避开 WXML 不支持 indexOf 的问题）
    personalityOptions: [],
    birthOrderOptions: BIRTH_ORDER_OPTIONS,
    gradeOptions: GRADE_OPTIONS,
    genderOptions: GENDER_OPTIONS,
    // 派生
    computedAge: null,
    personalityDisplay: "",
    submitting: false
  },

  onLoad(options) {
    const app = getApp();
    if (!app.globalData.isLoggedIn) {
      ensureLogin().catch(() => wx.navigateBack());
      return;
    }

    // 初始化性格选项，每个带 checked 字段
    this.setData({
      personalityOptions: PERSONALITY_OPTIONS.map(p => ({ ...p, checked: false }))
    });

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
      if (resp.result && resp.result.success && resp.result.data) {
        const c = resp.result.data;
        const personalityArr = c.personality || [];
        this.setData({
          name: c.name || "",
          birthYear: c.birthYear ? String(c.birthYear) : "",
          gender: c.gender || "",
          grade: c.grade || "",
          birthOrder: c.birthOrder || "",
          notes: c.notes || ""
        });
        this.syncPersonalityChecked(personalityArr);
      } else {
        wx.showToast({
          title: resp.result?.error || "加载档案失败",
          icon: "none"
        });
      }
    }).catch(() => {
      wx.hideLoading();
      const local = wx.getStorageSync("local_children") || [];
      const c = local.find(x => x._id === id);
      if (c) {
        const personalityArr = c.personality || [];
        this.setData({
          name: c.name || "", birthYear: String(c.birthYear || ""),
          gender: c.gender || "", grade: c.grade || "",
          birthOrder: c.birthOrder || "", notes: c.notes || ""
        });
        this.syncPersonalityChecked(personalityArr);
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

  // 性格多选 — 直接用 option 的 checked 字段切换
  togglePersonality(e) {
    const { value } = e.currentTarget.dataset;
    const options = this.data.personalityOptions.map(p => {
      if (p.value === value) return { ...p, checked: !p.checked };
      return p;
    });
    const personality = options.filter(p => p.checked).map(p => p.value);
    this.setData({ personalityOptions: options, personality });
    this.updateComputed();
  },

  // 从已有 personality 数组同步 checked 状态
  syncPersonalityChecked(personalityArr) {
    const options = this.data.personalityOptions.map(p => ({
      ...p,
      checked: personalityArr.indexOf(p.value) >= 0
    }));
    this.setData({ personalityOptions: options, personality: personalityArr });
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
    const app = getApp();
    if (!app.globalData.isLoggedIn) {
      ensureLogin();
      return;
    }

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
