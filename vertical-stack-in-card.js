console.log(
  `%cvertical-stack-in-card\n%cVersion: ${'1.1.0'}`,
  'color: #1976d2; font-weight: bold;',
  ''
);

class VerticalStackInCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._refCards = [];
    this._resizeObserver = null;
  }

  setConfig(config) {
    if (!config || !config.cards || !Array.isArray(config.cards)) {
      throw new Error('Invalid card configuration: "cards" array is required');
    }
    
    this._config = {
      title: config.title || '',
      cards: config.cards,
      horizontal: config.horizontal || false,
      spacing: config.spacing || 8,
      responsive: config.responsive || false,
      minWidth: config.minWidth || 300,
      styles: config.styles || {},
      parts: config.parts || {}
    };
    
    this.renderCard();
  }

  async renderCard() {
    try {
      // 清除现有内容
      while (this.shadowRoot.firstChild) {
        this.shadowRoot.removeChild(this.shadowRoot.firstChild);
      }
      
      // 创建卡片容器
      const card = document.createElement('ha-card');
      card.header = this._config.title;
      card.style.overflow = 'hidden';
      
      const cardContent = document.createElement('div');
      cardContent.classList.add('stack-container');
      cardContent.style.gap = `${this._config.spacing}px`;
      
      // 处理响应式布局
      if (this._config.responsive) {
        cardContent.style.display = 'grid';
        cardContent.style.gridTemplateColumns = `repeat(auto-fit, minmax(${this._config.minWidth}px, 1fr))`;
      } else if (this._config.horizontal) {
        cardContent.style.display = 'flex';
      }
      
      // 创建子卡片
      const cardPromises = this._config.cards.map(config => 
        this._createCardElement(config)
      );
      
      this._refCards = await Promise.all(cardPromises);
      
      // 应用样式和主题
      this._refCards.forEach(card => {
        this._applyCardStyles(card);
        cardContent.appendChild(card);
      });
      
      card.appendChild(cardContent);
      this.shadowRoot.appendChild(card);
      
      // 设置ResizeObserver用于动态调整尺寸
      this._setupResizeObserver(cardContent);
      
      // 应用主题变量
      this._applyTheme();
      
    } catch (error) {
      console.error('Vertical Stack Card rendering failed:', error);
      this._showErrorCard(error);
    }
  }

  async _createCardElement(cardConfig) {
    const helpers = await window.loadCardHelpers();
    
    // 处理分隔符类型
    const element = cardConfig.type === 'divider' 
      ? helpers.createRowElement(cardConfig)
      : helpers.createCardElement(cardConfig);
    
    element.hass = this._hass;
    
    // 优化重建事件处理
    element.addEventListener('ll-rebuild', (ev) => {
      ev.stopPropagation();
      this._handleCardRebuild(element, cardConfig);
    }, { once: true });
    
    return element;
  }

  _handleCardRebuild(oldCard, cardConfig) {
    const index = this._refCards.indexOf(oldCard);
    if (index === -1) return;
    
    this._createCardElement(cardConfig).then(newCard => {
      newCard.hass = this._hass;
      
      // 替换卡片
      const container = this.shadowRoot.querySelector('.stack-container');
      if (container && container.children[index]) {
        container.replaceChild(newCard, container.children[index]);
        this._refCards[index] = newCard;
        this._applyCardStyles(newCard);
      }
    });
  }

  _applyCardStyles(card) {
    // 应用全局样式
    if (this._config.styles && Object.keys(this._config.styles).length > 0) {
      Object.entries(this._config.styles).forEach(([key, value]) => {
        card.style.setProperty(key, value);
      });
    }
    
    // 应用部件样式
    if (this._config.parts && Object.keys(this._config.parts).length > 0) {
      const partStyles = Object.entries(this._config.parts).map(([part, styles]) => 
        `${part}: ${Object.entries(styles).map(([k, v]) => `${k}:${v}`).join(';')}`
      ).join('; ');
      
      if (card.part !== undefined) {
        card.part = partStyles;
      }
    }
    
    // 移除默认边距和边框
    if (card.shadowRoot) {
      const innerCard = card.shadowRoot.querySelector('ha-card');
      if (innerCard) {
        innerCard.style.boxShadow = 'none';
        innerCard.style.borderRadius = '0';
        innerCard.style.border = 'none';
      }
    }
  }

  _setupResizeObserver(container) {
    // 清理旧的Observer
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }
    
    // 创建新的ResizeObserver
    this._resizeObserver = new ResizeObserver(entries => {
      this._cardSize = Math.ceil(entries[0].contentRect.height / 50); // 转换为HA单位
    });
    
    this._resizeObserver.observe(container);
  }

  set hass(hass) {
    this._hass = hass;
    
    // 更新所有子卡片的HASS对象
    this._refCards.forEach(card => {
      if (card.hass !== hass) {
        card.hass = hass;
      }
    });
    
    // 应用主题变化
    this._applyTheme();
  }

  _applyTheme() {
    if (!this._hass || !this._hass.themes) return;
    
    const theme = this._hass.themes;
    const darkMode = theme.darkMode || false;
    
    // 设置CSS变量
    this.style.setProperty('--card-background', darkMode ? '#1e1e1e' : '#ffffff');
    this.style.setProperty('--primary-color', theme.primaryColor || '#1976d2');
    this.style.setProperty('--text-color', darkMode ? '#ffffff' : '#000000');
  }

  _showErrorCard(error) {
    const errorCard = document.createElement('hui-error-card');
    errorCard.setConfig({
      error: 'Vertical Stack Card Error',
      origConfig: this._config,
      detail: error.message
    });
    
    while (this.shadowRoot.firstChild) {
      this.shadowRoot.removeChild(this.shadowRoot.firstChild);
    }
    
    this.shadowRoot.appendChild(errorCard);
  }

  getCardSize() {
    return this._cardSize || 1;
  }

  static async getConfigElement() {
    await customElements.whenDefined('hui-vertical-stack-card');
    const cls = customElements.get('hui-vertical-stack-card');
    
    if (!cls) {
      const helpers = await window.loadCardHelpers();
      helpers.createCardElement({ type: 'vertical-stack', cards: [] });
      await customElements.whenDefined('hui-vertical-stack-card');
    }
    
    return document.createElement('hui-vertical-stack-card-editor');
  }

  static getStubConfig() {
    return {
      cards: [],
      title: 'Vertical Stack',
      spacing: 8
    };
  }

  disconnectedCallback() {
    // 清理ResizeObserver
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
  }
}

// 定义卡片样式
const style = document.createElement('style');
style.textContent = `
  .stack-container {
    display: flex;
    flex-direction: column;
    padding: 8px;
  }
  
  .stack-container > * {
    margin-bottom: var(--vertical-stack-spacing, 8px);
  }
  
  .stack-container > *:last-child {
    margin-bottom: 0;
  }
  
  @media (max-width: 600px) {
    .stack-container {
      flex-direction: column !important;
    }
  }
`;

// 注册自定义元素
if (!customElements.get('vertical-stack-in-card')) {
  customElements.define('vertical-stack-in-card', VerticalStackInCard);
  document.head.appendChild(style);
}

// HACS 集成
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'vertical-stack-in-card',
  name: 'Vertical Stack In Card',
  description: 'Group multiple cards vertically within a single card container',
  preview: true,
  documentationURL: 'https://github.com/ofekashery/vertical-stack-in-card',
});
