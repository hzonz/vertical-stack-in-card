import { LitElement, html, css } from 'https://unpkg.com/lit-element@2.0.1/lit-element.js?module';
import { window as globalWindow } from 'https://unpkg.com/home-assistant-js-websocket/dist/esm/fake-window.js?module';

class VerticalStackInCard extends LitElement {
  static get properties() {
    return {
      _config: { type: Object },
      _refCards: { type: Array },
      _hass: { type: Object },
    };
  }

  static get styles() {
    return css`
      ha-card {
        overflow: hidden;
        box-shadow: none;
        border-radius: 0;
        border: none;
      }
      .card-content {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .horizontal {
        flex-direction: row;
      }
    `;
  }

  constructor() {
    super();
    this._config = {};
    this._refCards = [];
  }

  setConfig(config) {
    if (!config || !Array.isArray(config.cards)) {
      throw new Error('Missing required "cards" array');
    }
    this._config = config;
    this.requestUpdate(); // Trigger re-render
  }

  set hass(hass) {
    this._hass = hass;
    this._refCards.forEach((card) => (card.hass = hass));
  }

  async render() {
    const { cards, horizontal } = this._config;

    // Create cards
    const promises = cards.map((cardConfig) => this._createCardElement(cardConfig));
    this._refCards = await Promise.all(promises);

    // Style cards
    this._refCards.forEach((card) => {
      if (card.updateComplete) {
        card.updateComplete.then(() => this._styleCard(card));
      } else {
        this._styleCard(card);
      }
    });

    return html`
      <ha-card>
        <div class="card-content ${horizontal ? 'horizontal' : ''}">
          ${this._refCards.map((card) => html`${card}`)}
        </div>
      </ha-card>
    `;
  }

  async _createCardElement(cardConfig) {
    const helpers = await globalWindow.loadCardHelpers();
    const element =
      cardConfig.type === 'divider'
        ? helpers.createRowElement(cardConfig)
        : helpers.createCardElement(cardConfig);

    element.hass = this._hass;
    element.addEventListener(
      'll-rebuild',
      () => {
        this.setConfig(this._config); // Rebuild card
      },
      { once: true }
    );
    return element;
  }

  _styleCard(element) {
    const styleCard = (el) => {
      if (el.shadowRoot) {
        const innerCard = el.shadowRoot.querySelector('ha-card');
        if (innerCard) {
          innerCard.style.boxShadow = 'none';
          innerCard.style.borderRadius = '0';
          innerCard.style.border = 'none';
        }
      }
    };

    styleCard(element);
    for (const child of element.children) {
      styleCard(child);
    }
  }

  async getCardSize() {
    const sizes = await Promise.all(this._refCards.map((card) => {
      if (typeof card.getCardSize === 'function') return card.getCardSize();
      return 1; // Default size
    }));
    return sizes.reduce((a, b) => a + b, 0);
  }

  getGridOptions() {
    // Define default grid behavior (rows/columns)
    return {
      rows: 2,
      columns: 6,
      min_rows: 2,
    };
  }

  static async getConfigElement() {
    const cls = customElements.get('hui-vertical-stack-card');
    if (!cls) {
      await globalWindow.loadCardHelpers();
      await customElements.whenDefined('hui-vertical-stack-card');
    }

    const configElement = await cls.getConfigElement();
    const originalSetConfig = configElement.setConfig;
    configElement.setConfig = (config) =>
      originalSetConfig.call(configElement, {
        type: config.type,
        title: config.title,
        cards: config.cards || [],
      });
    return configElement;
  }

  static getStubConfig() {
    return {
      cards: [],
    };
  }
}

customElements.define('vertical-stack-in-card', VerticalStackInCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'vertical-stack-in-card',
  name: 'Vertical Stack In Card',
  description: 'Group multiple cards into a single sleek card.',
  preview: false,
  documentationURL: 'https://github.com/hzonz/vertical-stack-in-card',
});
