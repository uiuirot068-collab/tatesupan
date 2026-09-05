/*
 * Shared content/data for the UI-A / UI-B / UI-C comparison prototypes.
 *
 * Purpose: guarantee the three variants are compared on IDENTICAL content —
 * same toolbar buttons, same settings fields, same sample manuscript, same
 * memo default text — per the Phase 1 requirement that UI variants not be
 * made to look better/worse than each other by differing feature amounts.
 *
 * Each variant's own script wires up ONLY the switching mechanism; all
 * literal content comes from here.
 */

const TSDemo = (() => {
  const MANUSCRIPT_TEXT =
    "「気が合った、と言ってしまえばそれまでだ。けれど気づけば、どこへ行くにも二人でいることが当たり前になっていた。」\n\n" +
    "窓の外では雨が降り続いていた。傘を持たずに出てきたことを、今更ながら少し悔やんだ。それでも歩調を緩める気にはならなかった。" +
    "駅までの道のりは、いつもよりずっと長く感じられた。\n\n" +
    "――それでも、まだ引き返す理由にはならない。";

  const MEMO_DEFAULT =
    "（メモ）\n次の章の展開について：\n・伏線Aの回収位置を再検討\n・地の文とセリフのリズムを見直す";

  const TOOLBAR_BUTTONS = [
    { id: "save", icon: "💾", label: "保存" },
    { id: "undo", icon: "↶", label: "元に戻す" },
    { id: "redo", icon: "↷", label: "やり直す" },
    { id: "image", icon: "🖼", label: "挿絵" },
    { id: "pagebreak", icon: "⏎", label: "改ページ" },
    { id: "preview", icon: "👁", label: "プレビュー" },
    { id: "memo", icon: "📝", label: "メモ" },
  ];

  const SETTINGS_GROUPS = [
    {
      title: "用紙・組版",
      fields: [
        {
          type: "select",
          label: "用紙プリセット",
          options: ["文庫", "A5（1段）", "A5（2段）", "B5", "B6", "新書", "A6", "Web閲覧用"],
          selected: "文庫",
        },
        {
          type: "select",
          label: "段組み",
          options: ["1段", "2段"],
          selected: "1段",
        },
        {
          type: "radio-pair",
          label: "余白の決め方",
          options: ["文字数・行数から設定", "余白から設定"],
          selected: "文字数・行数から設定",
          hint: "文字数・行数から設定＝目標の文字数/行数を入力し、余白は自動算出。余白から設定＝天地ノド小口を直接入力し、文字数/行数は上限として自動表示。",
        },
      ],
    },
    {
      title: "フォント",
      fields: [
        {
          type: "select",
          label: "本文フォント",
          options: ["しっぽり明朝", "Zenオールド明朝", "Noto Serif 明朝", "Noto Sans ゴシック", "システム標準明朝"],
          selected: "しっぽり明朝",
        },
        {
          type: "number",
          label: "本文文字サイズ（pt）",
          value: 10.5,
        },
        {
          type: "checkbox",
          label: "柱・奥付フォントは本文と同じ",
          checked: true,
          hint: "オフにすると、柱（ページ上部の見出し）と奥付のフォントを本文と独立して選べます。",
        },
      ],
    },
    {
      title: "ページ番号",
      fields: [
        {
          type: "select",
          label: "ノンブル位置",
          options: ["中央", "ノド", "小口", "非表示"],
          selected: "小口",
        },
        {
          type: "number",
          label: "開始番号",
          value: 1,
        },
      ],
    },
  ];

  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === "class") e.className = attrs[k];
        else if (k === "text") e.textContent = attrs[k];
        else e.setAttribute(k, attrs[k]);
      }
    }
    (children || []).forEach((c) => e.appendChild(c));
    return e;
  }

  function renderToolbar(container, handlers) {
    container.innerHTML = "";
    container.className = "toolbar";
    TOOLBAR_BUTTONS.forEach((b) => {
      const btn = el("button", { class: "toolbar-btn", "data-action": b.id, title: b.label });
      const icon = el("span", { "aria-hidden": "true" });
      icon.textContent = b.icon;
      const label = el("span", { class: "btn-label" });
      label.textContent = b.label;
      btn.appendChild(icon);
      btn.appendChild(label);
      btn.addEventListener("click", () => {
        if (handlers && handlers[b.id]) handlers[b.id]();
      });
      container.appendChild(btn);
    });
  }

  function renderManuscript(container) {
    container.innerHTML = "";
    container.className = "editor-page";
    const sheet = el("div", { class: "manuscript-sheet", contenteditable: "true", spellcheck: "false" });
    sheet.textContent = MANUSCRIPT_TEXT;
    container.appendChild(sheet);
    return sheet;
  }

  function renderPreviewPlaceholder(container) {
    const box = el("div", { class: "preview-placeholder" });
    box.textContent =
      "プレビュー（概念プレースホルダー）— 最終レンダラー未確定。ここでは表示位置・アクセス方法の比較のみを目的とする。";
    container.appendChild(box);
  }

  function renderSettingsForm(container) {
    container.innerHTML = "";
    container.className = "settings-page";
    const form = el("div", { class: "settings-form" });
    SETTINGS_GROUPS.forEach((group) => {
      form.appendChild(el("h2", { text: group.title }));
      group.fields.forEach((f) => {
        if (f.type === "select") {
          const row = el("div", { class: "field-row" });
          row.appendChild(el("label", { text: f.label }));
          const sel = el("select");
          f.options.forEach((o) => {
            const opt = el("option", { text: o });
            if (o === f.selected) opt.setAttribute("selected", "selected");
            sel.appendChild(opt);
          });
          row.appendChild(sel);
          form.appendChild(row);
        } else if (f.type === "number") {
          const row = el("div", { class: "field-row" });
          row.appendChild(el("label", { text: f.label }));
          const input = el("input", { type: "number", value: f.value, step: "0.5" });
          row.appendChild(input);
          form.appendChild(row);
        } else if (f.type === "checkbox") {
          const row = el("div", { class: "field-row" });
          row.appendChild(el("label", { text: f.label }));
          const input = el("input", { type: "checkbox" });
          input.checked = !!f.checked;
          row.appendChild(input);
          form.appendChild(row);
          if (f.hint) {
            const hint = el("div", { class: "field-hint", text: f.hint });
            form.appendChild(hint);
          }
        } else if (f.type === "radio-pair") {
          const row = el("div", { class: "field-row" });
          row.appendChild(el("label", { text: f.label }));
          const sel = el("select");
          f.options.forEach((o) => {
            const opt = el("option", { text: o });
            if (o === f.selected) opt.setAttribute("selected", "selected");
            sel.appendChild(opt);
          });
          row.appendChild(sel);
          form.appendChild(row);
          if (f.hint) {
            const hint = el("div", { class: "field-hint", text: f.hint });
            form.appendChild(hint);
          }
        }
      });
    });
    container.appendChild(form);
  }

  function createMemoOverlay() {
    const overlay = el("div", { class: "memo-overlay" });
    const card = el("div", { class: "memo-card" });
    const header = el("div", {});
    header.innerHTML = "";
    const headerEl = document.createElement("header");
    const h3 = el("h3", { text: "メモ" });
    const closeBtn = el("button", { class: "memo-close", text: "×", "aria-label": "メモを閉じる" });
    headerEl.appendChild(h3);
    headerEl.appendChild(closeBtn);
    const textarea = el("textarea");
    textarea.value = MEMO_DEFAULT;
    card.appendChild(headerEl);
    card.appendChild(textarea);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    function open() { overlay.classList.add("open"); textarea.focus(); }
    function close() { overlay.classList.remove("open"); }
    closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

    return { open, close, element: overlay };
  }

  return {
    MANUSCRIPT_TEXT,
    MEMO_DEFAULT,
    TOOLBAR_BUTTONS,
    SETTINGS_GROUPS,
    renderToolbar,
    renderManuscript,
    renderPreviewPlaceholder,
    renderSettingsForm,
    createMemoOverlay,
  };
})();
