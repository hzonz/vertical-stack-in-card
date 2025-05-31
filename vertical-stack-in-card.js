console.log(
  `%cvertical-stack-in-card\n%cVersion: ${'2.0.0'}`,
  'color: #1976d2; font-weight: bold;',
  ''
);

class VerticalStackInCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }); // 提前创建 Shadow DOM :cite[7]
    this._eventListeners = []; // 存储事件监听器
  }

  disconnectedCallback() {
    // 清理事件监听器防止内存泄漏 :cite[7]
    this._eventListeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
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
    container.style.display = 'flex';
    container.style.flexDirection = this._config.horizontal ? 'row' : 'column';
    container.style.gap = this._config.spacing || '12px';
    container.style.padding = this._config.padding || '16px';

    // 响应式布局：小屏幕强制垂直排列
    const style = document.createElement('style');
    style.textContent = `
      @media (max-width: 600px) {
        .container { flex-direction: column !important; }
      }
    `;
    container.classList.add('container');
    card.appendChild(style);

    // 创建子卡片
    this._refCards = [];
    for (const cardConfig of this._config.cards) {
      try {
        const cardElement = await this._createCardElement(cardConfig);
        this._applyStyles(cardElement); // 应用样式
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

    // 处理 LitElement 异步渲染
    if (element.updateComplete) await element.updateComplete;

    // 处理卡片重建事件
    const rebuildHandler = (ev) => {
      ev.stopPropagation();
      this.renderCard();
    };
    element.addEventListener('ll-rebuild', rebuildHandler);
    this._eventListeners.push({ element, type: 'll-rebuild', handler: rebuildHandler });

    return element;
  }

  _applyStyles(element) {
    // 现代样式注入方式 (兼容 LitElement) :cite[1]:cite[7]
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
    this._refCards?.forEach(card => (card.hass = hass));
  }

  async getCardSize() {
    if (!this._refCards) return 1;
    
    let totalSize = 0;
    for (const card of this._refCards) {
      if (card.getCardSize) {
        // 等待 LitElement 渲染完成
        if (card.updateComplete) await card.updateComplete;
        totalSize += await card.getCardSize();
      } else {
        totalSize += 1; // 默认大小
      }
    }
    return totalSize;
  }

  // 禁用配置编辑器 (兼容新版 HA) :cite[7]
  static getConfigElement() {
    return null;
  }

  static getStubConfig() {
    return { cards: [] };
  }
}

// 注册自定义元素
if (!customElements.get('vertical-stack-in-card')) {
  customElements.define('vertical-stack-in-card', VerticalStackInCard);
}

// HACS 集成声明
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'vertical-stack-in-card',
  name: 'Vertical Stack In Card',
  preview: true,
  description: 'Group multiple cards in a single container',
  documentationURL: 'https://github.com/ofekashery/vertical-stack-in-card'
});
