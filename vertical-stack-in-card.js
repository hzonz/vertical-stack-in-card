console.log(
  `%cvertical-stack-in-card\n%cVersion: ${'1.1.1'}`,
  'color: #1976d2; font-weight: bold;',
  ''
);

class VerticalStackInCard extends LitElement {
  static get properties() {
    return {
      config: { type: Object },
      hass: { type: Object }
    };
  }

  constructor() {
    super();
    this._refCards = [];
    this._resizeObserver = null;
    this._cardSize = 1;
  }

  setConfig(config) {
    if (!config?.cards?.length) {
      throw new Error('Invalid card configuration: "cards" array is required');
    }
    this.config = {
      title: config.title || '',
      cards: config.cards,
      spacing: config.spacing ?? 8,
      responsive: config.responsive ?? false,
      minWidth: config.minWidth ?? 300,
      styles: config.styles || {},
      parts: config.parts || {}
    };
  }

  render() {
    return html`
    <ha-card .header=${this.config.title}>
      <div id="container" class="stack-container"></div>
    </ha-card>`;
  }

  firstUpdated() {
    this._renderStack();
  }

  updated(changed) {
    if (changed.has('config') && this.config) this._renderStack();
    if (changed.has('hass')) this._updateChildHass();
  }

  async _renderStack() {
    const cont = this.renderRoot.querySelector('#container');
    cont.innerHTML = '';
    cont.style.display = this.config.responsive
      ? 'grid' : 'flex';
    cont.style.gridTemplateColumns = this.config.responsive
      ? `repeat(auto-fit, minmax(${this.config.minWidth}px,1fr))` : '';
    cont.style.gap = `${this.config.spacing}px`;

    const helpers = await window.loadCardHelpers();
    this._refCards = await Promise.all(
      this.config.cards.map(c => this._createCardElement(c, helpers))
    );

    this._refCards.forEach(el => {
      this._applyCardStyles(el);
      cont.appendChild(el);
    });

    this._setupResizeObserver(cont);
  }

  async _createCardElement(cfg, helpers) {
    await new Promise(r => requestAnimationFrame(r));
    const el = cfg.type === 'divider'
      ? helpers.createRowElement(cfg)
      : helpers.createCardElement(cfg);
    el.hass = this.hass;
    el.addEventListener('ll-rebuild', e => {
      e.stopPropagation();
      this._handleCardRebuild(el, cfg, helpers);
    }, { once: true });
    return el;
  }

  _handleCardRebuild(oldEl, cfg, helpers) {
    const idx = this._refCards.indexOf(oldEl);
    if (idx < 0) return;
    this._createCardElement(cfg, helpers).then(newEl => {
      newEl.hass = this.hass;
      const cont = this.renderRoot.querySelector('#container');
      cont.replaceChild(newEl, cont.children[idx]);
      this._refCards[idx] = newEl;
      this._applyCardStyles(newEl);
    });
  }

  _applyCardStyles(el) {
    Object.entries(this.config.styles).forEach(([k, v]) => el.style.setProperty(k, v));
    if (el.shadowRoot) {
      const inner = el.shadowRoot.querySelector('ha-card');
      if (inner) Object.assign(inner.style, {
        boxShadow: 'none',
        borderRadius: '0',
        border: 'none'
      });
    }
  }

  _setupResizeObserver(container) {
    this._resizeObserver?.disconnect();
    this._resizeObserver = new ResizeObserver(entries => {
      requestAnimationFrame(() => {
        this._cardSize = Math.ceil(entries[0].contentRect.height / 50);
      });
    });
    this._resizeObserver.observe(container);
  }

  _updateChildHass() {
    this._refCards.forEach(el => el.hass = this.hass);
  }

  getCardSize() {
    return this._cardSize;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._resizeObserver?.disconnect();
  }

  static get styles() {
    return css`
    .stack-container {
      padding: 8px;
      flex-direction: column;
    }
    .stack-container > *:not(:last-child) {
      margin-bottom: var(--vertical-stack-spacing, 8px);
    }
    @media (max-width:600px) {
      .stack-container { flex-direction: column !important; }
    }`;
  }
}
customElements.define('vertical-stack-in-card', VerticalStackInCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'vertical-stack-in-card',
  name: 'Vertical Stack In Card (Optimized)',
  description: 'Group cards vertically with improved performance',
  preview: true,
  documentationURL: 'https://github.com/ofekashery/vertical-stack-in-card'
});
