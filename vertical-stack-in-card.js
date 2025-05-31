console.log(
  `%cvertical-stack-in-card\n%cVersion: ${'2.0.0'}`,
  'color: #1976d2; font-weight: bold;',
  ''
);

class VerticalStackInCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._eventListeners = [];
    this._editMode = false; // 可视化编辑模式状态
  }

  disconnectedCallback() {
    this._clearEventListeners();
  }

  setConfig(config) {
    if (!config?.cards || !Array.isArray(config.cards)) {
      throw new Error('Invalid card configuration');
    }
    this._config = config;
    this.renderCard();
  }

  async renderCard() {
    // 清空现有内容
    while (this.shadowRoot.firstChild) {
      this.shadowRoot.firstChild.remove();
    }

    // 创建主卡片容器
    const card = document.createElement('ha-card');
    card.style.overflow = 'hidden';
    if (this._config.title) card.header = this._config.title;

    // 创建内容容器
    const container = document.createElement('div');
    container.id = 'container';
    container.style.display = 'flex';
    container.style.flexDirection = this._config.horizontal ? 'row' : 'column';
    container.style.gap = this._config.spacing || '12px';
    container.style.padding = this._config.padding || '16px';

    // 响应式样式
    const style = document.createElement('style');
    style.textContent = `
      @media (max-width: 600px) {
        #container {
          flex-direction: column !important;
        }
      }
      .edit-mode-highlight {
        outline: 2px dashed #ff9800;
        outline-offset: 4px;
        transition: outline 0.3s ease;
      }
    `;
    this.shadowRoot.appendChild(style);

    // 创建子卡片
    this._refCards = [];
    for (const cardConfig of this._config.cards) {
      try {
        const cardElement = await this._createCardElement(cardConfig);
        this._applyStyles(cardElement);
        
        // 可视化编辑模式高亮
        if (this._editMode) {
          cardElement.classList.add('edit-mode-highlight');
        }
        
        container.appendChild(cardElement);
        this._refCards.push(cardElement);
      } catch (error) {
        console.error('Card creation failed:', error);
        const errorCard = document.createElement('hui-error-card');
        container.appendChild(errorCard);
      }
    }

    card.appendChild(container);
    this.shadowRoot.appendChild(card);
  }

  async _createCardElement(cardConfig) {
    const helpers = await window.loadCardHelpers();
    const element = helpers.createCardElement(cardConfig);
    element.hass = this._hass;

    // 处理异步渲染
    if (element.updateComplete) await element.updateComplete;

    // 卡片重建事件
    const rebuildHandler = (ev) => {
      ev.stopPropagation();
      this.renderCard();
    };
    element.addEventListener('ll-rebuild', rebuildHandler);
    this._eventListeners.push({ 
      element, 
      type: 'll-rebuild', 
      handler: rebuildHandler 
    });

    return element;
  }

  _applyStyles(element) {
    if (this._config.styles) {
      const styleTag = document.createElement('style');
      styleTag.textContent = `
        ha-card {
          --ha-card-box-shadow: none;
          --ha-card-border-width: 0;
          ${Object.entries(this._config.styles)
            .map(([key, value]) => `${key}: ${value} !important;`)
            .join('\n')}
        }
      `;
      
      if (element.shadowRoot) {
        element.shadowRoot.appendChild(styleTag);
      } else {
        element.appendChild(styleTag);
      }
    }
  }

  set hass(hass) {
    this._hass = hass;
    this._refCards?.forEach(card => {
      card.hass = hass;
      // 编辑模式下刷新子卡片
      if (this._editMode && card.setEditMode) {
        card.setEditMode(true);
      }
    });
  }

  // ================= 可视化编辑支持 =================
  setEditMode(editMode) {
    this._editMode = editMode;
    
    // 高亮显示子卡片
    this.shadowRoot.querySelectorAll('.edit-mode-highlight').forEach(el => {
      el.classList.toggle('edit-mode-highlight', editMode);
    });
    
    // 传递编辑模式到子卡片
    this._refCards?.forEach(card => {
      if (card.setEditMode) card.setEditMode(editMode);
    });
    
    // 可视化编辑模式下添加拖拽占位符
    if (editMode) {
      this._addDragPlaceholders();
    }
  }

  // 添加拖拽占位符
  _addDragPlaceholders() {
    const container = this.shadowRoot.getElementById('container');
    if (!container) return;
    
    // 移除现有占位符
    container.querySelectorAll('.drag-placeholder').forEach(el => el.remove());
    
    // 在每个子卡片后添加占位符
    this._refCards.forEach((card, index) => {
      const placeholder = document.createElement('div');
      placeholder.className = 'drag-placeholder';
      placeholder.style.height = '20px';
      placeholder.style.background = 'rgba(255, 152, 0, 0.2)';
      placeholder.style.margin = '4px 0';
      placeholder.style.borderRadius = '4px';
      placeholder.style.cursor = 'pointer';
      
      // 点击占位符添加新卡片
      placeholder.onclick = () => {
        const newCards = [...this._config.cards];
        newCards.splice(index + 1, 0, { type: 'entities' }); // 默认添加实体卡片
        this.setConfig({ ...this._config, cards: newCards });
      };
      
      container.insertBefore(placeholder, card.nextSibling);
    });
    
    // 在末尾添加占位符
    const endPlaceholder = document.createElement('div');
    endPlaceholder.className = 'drag-placeholder';
    endPlaceholder.style.height = '20px';
    endPlaceholder.style.background = 'rgba(255, 152, 0, 0.2)';
    endPlaceholder.style.margin = '4px 0';
    endPlaceholder.style.borderRadius = '4px';
    endPlaceholder.style.cursor = 'pointer';
    
    endPlaceholder.onclick = () => {
      this.setConfig({
        ...this._config,
        cards: [...this._config.cards, { type: 'entities' }]
      });
    };
    
    container.appendChild(endPlaceholder);
  }

  _clearEventListeners() {
    this._eventListeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this._eventListeners = [];
  }

  async getCardSize() {
    if (!this._refCards) return 1;
    
    let totalSize = 0;
    for (const card of this._refCards) {
      if (card.getCardSize) {
        if (card.updateComplete) await card.updateComplete;
        totalSize += await card.getCardSize();
      } else {
        totalSize += 1;
      }
    }
    return totalSize;
  }

  // ================= 配置编辑器集成 =================
  static getConfigElement() {
    return document.createElement('vertical-stack-in-card-editor');
  }

  static getPropertyElement() {
    return document.createElement('vertical-stack-in-card-property-editor');
  }

  static getStubConfig() {
    return {
      cards: [
        { type: 'entities', entities: [] },
        { type: 'entities', entities: [] }
      ]
    };
  }
}

// ================= 自定义编辑器组件 =================
class VerticalStackInCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    
    if (!this._renderPromise) {
      this._renderPromise = this._render();
    }
  }

  async _render() {
    // 加载编辑器依赖
    await Promise.all([
      customElements.whenDefined('ha-form'),
      customElements.whenDefined('hui-card-picker')
    ]);
    
    // 创建表单
    this.innerHTML = '';
    const form = document.createElement('ha-form');
    form.schema = [
      {
        name: 'title',
        selector: { text: {} },
        label: '卡片标题'
      },
      {
        name: 'horizontal',
        selector: { boolean: {} },
        label: '水平布局'
      },
      {
        name: 'spacing',
        selector: { 
          select: {
            options: [
              { value: '4px', label: '小间距' },
              { value: '8px', label: '中间距' },
              { value: '12px', label: '大间距' }
            ]
          }
        },
        label: '卡片间距'
      }
    ];
    
    form.data = this._config;
    form.addEventListener('value-changed', (ev) => {
      this._config = { ...this._config, ...ev.detail.value };
      this.dispatchEvent(new CustomEvent('config-changed', {
        detail: { config: this._config }
      }));
    });
    
    // 卡片管理标题
    const header = document.createElement('h3');
    header.style.marginBottom = '8px';
    header.textContent = '管理子卡片';
    this.appendChild(header);
    
    // 卡片列表
    const cardList = document.createElement('div');
    cardList.style.display = 'grid';
    cardList.style.gap = '8px';
    this._config.cards.forEach((cardConfig, index) => {
      const cardElement = this._createCardElement(cardConfig, index);
      cardList.appendChild(cardElement);
    });
    
    // 添加卡片按钮
    const addButton = document.createElement('mwc-button');
    addButton.label = '添加卡片';
    addButton.icon = 'add';
    addButton.style.marginTop = '16px';
    addButton.addEventListener('click', () => {
      this._config.cards.push({ type: 'entities' });
      this.dispatchEvent(new CustomEvent('config-changed', {
        detail: { config: this._config }
      }));
      this._render();
    });
    
    this.appendChild(form);
    this.appendChild(cardList);
    this.appendChild(addButton);
  }

  _createCardElement(cardConfig, index) {
    const cardElement = document.createElement('div');
    cardElement.style.display = 'flex';
    cardElement.style.alignItems = 'center';
    cardElement.style.gap = '8px';
    
    // 卡片类型标签
    const typeLabel = document.createElement('span');
    typeLabel.style.flex = '1';
    typeLabel.textContent = `卡片 ${index + 1}: ${cardConfig.type || '未命名'}`;
    
    // 编辑按钮
    const editButton = document.createElement('mwc-icon-button');
    editButton.icon = 'edit';
    editButton.title = '编辑此卡片';
    editButton.addEventListener('click', () => {
      this._editCard(index);
    });
    
    // 删除按钮
    const deleteButton = document.createElement('mwc-icon-button');
    deleteButton.icon = 'delete';
    deleteButton.title = '删除此卡片';
    deleteButton.addEventListener('click', () => {
      this._config.cards.splice(index, 1);
      this.dispatchEvent(new CustomEvent('config-changed', {
        detail: { config: this._config }
      }));
      this._render();
    });
    
    cardElement.appendChild(typeLabel);
    cardElement.appendChild(editButton);
    cardElement.appendChild(deleteButton);
    return cardElement;
  }

  _editCard(index) {
    const cardConfig = this._config.cards[index];
    const editor = document.createElement('hui-card-editor');
    editor.hass = this.hass;
    editor.setConfig(cardConfig);
    
    editor.addEventListener('config-changed', (ev) => {
      ev.stopPropagation();
      this._config.cards[index] = ev.detail.config;
      this.dispatchEvent(new CustomEvent('config-changed', {
        detail: { config: this._config },
        bubbles: true
      }));
    });
    
    // 创建编辑对话框
    const dialog = document.createElement('ha-dialog');
    dialog.heading = `编辑卡片 ${index + 1}`;
    dialog.style.setProperty('--mdc-dialog-min-width', '600px');
    dialog.appendChild(editor);
    dialog.open = true;
    
    dialog.addEventListener('closed', () => {
      document.body.removeChild(dialog);
    });
    
    document.body.appendChild(dialog);
  }
}

// 注册编辑器组件
if (!customElements.get('vertical-stack-in-card-editor')) {
  customElements.define('vertical-stack-in-card-editor', VerticalStackInCardEditor);
}

// ================= 主卡片注册 =================
if (!customElements.get('vertical-stack-in-card')) {
  customElements.define('vertical-stack-in-card', VerticalStackInCard);
}

// HACS 集成声明
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'vertical-stack-in-card',
  name: '垂直堆叠卡片',
  preview: true,
  description: '在单个卡片容器中垂直/水平堆叠多个卡片',
  documentationURL: 'https://github.com/hzonz/vertical-stack-in-card',
  // 关键可视化编辑支持声明
  configurable: true,
  layout: true,
  editor: 'vertical-stack-in-card-editor'
});
