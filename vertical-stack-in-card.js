console.log(
  `%cvertical-stack-in-card\n%cVersion: ${'1.2.0'}`,
  'color: #1976d2; font-weight: bold;',
  ''
);

class VerticalStackInCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._refCards = [];
    this._resizeObserver = null;
    this._gridLayout = null;
  }

  setConfig(config) {
    if (!config || !config.cards || !Array.isArray(config.cards)) {
      throw new Error('Invalid card configuration: "cards" array is required');
    }
    
    // 保留官方 grid_options 参数
    this._config = {
      title: config.title || '',
      cards: config.cards,
      horizontal: config.horizontal || false,
      spacing: config.spacing || 8,
      responsive: config.responsive || false,
      minWidth: config.minWidth || 300,
      styles: config.styles || {},
      parts: config.parts || {},
      // 新增官方 grid_options 支持
      grid_options: config.grid_options || null
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
      
      // 创建网格容器（如果使用 grid_options）
      if (this._config.grid_options) {
        this._gridLayout = document.createElement('div');
        this._gridLayout.classList.add('grid-layout');
        this._applyGridOptions();
      } else {
        this._gridLayout = document.createElement('div');
        this._gridLayout.classList.add('stack-container');
        this._gridLayout.style.gap = `${this._config.spacing}px`;
      }
      
      // 处理响应式布局
      if (this._config.responsive && !this._config.grid_options) {
        this._gridLayout.style.display = 'grid';
        this._gridLayout.style.gridTemplateColumns = `repeat(auto-fit, minmax(${this._config.minWidth}px, 1fr))`;
      } else if (this._config.horizontal && !this._config.grid_options) {
        this._gridLayout.style.display = 'flex';
      }
      
      // 创建子卡片
      const cardPromises = this._config.cards.map(config => 
        this._createCardElement(config)
      );
      
      this._refCards = await Promise.all(cardPromises);
      
      // 应用样式和主题
      this._refCards.forEach(card => {
        this._applyCardStyles(card);
        this._gridLayout.appendChild(card);
      });
      
      card.appendChild(this._gridLayout);
      this.shadowRoot.appendChild(card);
      
      // 设置ResizeObserver用于动态调整尺寸
      this._setupResizeObserver(this._gridLayout);
      
      // 应用主题变量
      this._applyTheme();
      
    } catch (error) {
      console.error('Vertical Stack Card rendering failed:', error);
      this._showErrorCard(error);
    }
  }

  _applyGridOptions() {
    if (!this._config.grid_options) return;
    
    const options = this._config.grid_options;
    this._gridLayout.style.display = 'grid';
    
    // 处理列配置
    if (options.columns) {
      if (typeof options.columns === 'number') {
        this._gridLayout.style.gridTemplateColumns = `repeat(${options.columns}, 1fr)`;
      } else if (Array.isArray(options.columns)) {
        this._gridLayout.style.gridTemplateColumns = options.columns.join(' ');
      } else if (typeof options.columns === 'string') {
        this._gridLayout.style.gridTemplateColumns = options.columns;
      }
    }
    
    // 处理行配置
    if (options.rows) {
      if (typeof options.rows === 'number') {
        this._gridLayout.style.gridTemplateRows = `repeat(${options.rows}, auto)`;
      } else if (Array.isArray(options.rows)) {
        this._gridLayout.style.gridTemplateRows = options.rows.join(' ');
      } else if (typeof options.rows === 'string') {
        this._gridLayout.style.gridTemplateRows = options.rows;
      }
    }
    
    // 处理间距
    if (options.gap) {
      this._gridLayout.style.gap = typeof options.gap === 'string' ? 
        options.gap : `${options.gap}px`;
    } else if (this._config.spacing) {
      this._gridLayout.style.gap = `${this._config.spacing}px`;
    }
    
    // 处理对齐方式
    if (options.align_items) {
      this._gridLayout.style.alignItems = options.align_items;
    }
    if (options.justify_content) {
      this._gridLayout.style.justifyContent = options.justify_content;
    }
  }

  // ... 其他方法保持不变（_createCardElement, _handleCardRebuild, 等）...

  static async getConfigElement() {
    await customElements.whenDefined('hui-vertical-stack-card');
    const cls = customElements.get('hui-vertical-stack-card');
    
    if (!cls) {
      const helpers = await window.loadCardHelpers();
      helpers.createCardElement({ type: 'vertical-stack', cards: [] });
      await customElements.whenDefined('hui-vertical-stack-card');
    }
    
    const configElement = document.createElement('hui-vertical-stack-card-editor');
    
    // 添加 grid_options 支持到编辑器
    if (configElement) {
      configElement.addEventListener('config-changed', (ev) => {
        const config = ev.detail.config;
        if (config.grid_options) {
          // 确保配置中包含 grid_options
          if (!configElement._config) configElement._config = {};
          configElement._config.grid_options = config.grid_options;
        }
      });
    }
    
    return configElement;
  }
}

// 更新样式以支持 grid_options
const style = document.createElement('style');
style.textContent = `
  .stack-container {
    display: flex;
    flex-direction: column;
    padding: 8px;
    gap: var(--vertical-stack-spacing, 8px);
  }
  
  .grid-layout {
    display: grid;
    padding: 8px;
  }
  
  @media (max-width: 600px) {
    .stack-container, .grid-layout {
      grid-template-columns: 1fr !important;
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
  description: 'Group multiple cards vertically within a single card container with grid support',
  preview: true,
  documentationURL: 'https://github.com/ofekashery/vertical-stack-in-card',
});